// src/websocket/socketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db/db';
import { journeyOps, journeys, journeyBreadcrumbs, syncState } from '../db/schema'; // Import your schemas
import { eq, desc } from 'drizzle-orm';

// Define the shape of the message we expect from the client
interface WsMessage {
  type: 'SYNC_OPS' | 'PING';
  payload: any;
}

interface IncomingOp {
  opId: string;
  journeyId: string;
  userId: number;
  type: 'START' | 'MOVE' | 'STOP';
  payload: any; // Contains lat, lng, speed, etc.
  createdAt: string;
}

export function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 3000 });

  console.log('✅ Geo-Tracking WebSocket Server running on ws://localhost:3000');

  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('🔌 New Client Connected');

    // Optional: Parse User ID from URL (e.g., ws://localhost:3000?userId=123)
    // const url = new URL(req.url || '', 'http://localhost');
    // const userId = url.searchParams.get('userId');

    ws.on('message', async (data) => {
      try {
        const messageString = data.toString();
        const message: WsMessage = JSON.parse(messageString);

        if (message.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
          return;
        }

        if (message.type === 'SYNC_OPS') {
          await handleSyncOps(ws, message.payload);
        }

      } catch (err) {
        console.error('❌ WS Error:', err);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 Client Disconnected');
    });
  });
}

/**
 * Handles incoming operations (START, MOVE, STOP)
 * Persists to journeyOps, journeyBreadcrumbs, and updates Journeys
 */
async function handleSyncOps(ws: WebSocket, ops: IncomingOp[]) {
  const acks = [];

  for (const op of ops) {
    try {
      // 1. Idempotency Check: Did we already save this op?
      const [existing] = await db
        .select()
        .from(journeyOps)
        .where(eq(journeyOps.opId, op.opId));

      if (existing) {
        acks.push({ opId: op.opId, status: 'ALREADY_PROCESSED' });
        continue;
      }

      // 2. Insert into 'journey_ops' (The Source of Truth)
      // This table uses 'serverSeq' which auto-increments
      await db.insert(journeyOps).values({
        opId: op.opId,
        journeyId: op.journeyId,
        userId: op.userId,
        type: op.type,
        payload: op.payload, // Storing full JSON payload
        createdAt: new Date(op.createdAt),
      });

      // 3. Process Specific Logic based on Op Type
      if (op.type === 'MOVE') {
        // payload usually looks like: { lat: 12.34, lng: 56.78, ... }
        const { latitude, longitude, speed, h3Index, accuracy, heading, altitude, batteryLevel } = op.payload;
        
        // Insert into 'journey_breadcrumbs'
        await db.insert(journeyBreadcrumbs).values({
            id: crypto.randomUUID(),
            journeyId: op.journeyId,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            h3Index: h3Index,
            speed: speed,
            accuracy: accuracy,
            heading: heading,
            altitude: altitude,
            batteryLevel: batteryLevel,
            recordedAt: new Date(op.createdAt), // Use the client's timestamp
            isSynced: true
        });

      } else if (op.type === 'STOP') {
        // Update 'journeys' status to COMPLETED
        await db.update(journeys)
          .set({ 
            status: 'COMPLETED',
            endTime: new Date(op.createdAt),
            updatedAt: new Date()
          })
          .where(eq(journeys.id, op.journeyId));
      }

      // 4. Acknowledge success
      acks.push({ opId: op.opId, status: 'OK' });

    } catch (dbError) {
      console.error(`Failed to process op ${op.opId}:`, dbError);
      acks.push({ opId: op.opId, status: 'FAILED' });
    }
  }

  // Send ACKs back to client so they can delete from their local queue
  ws.send(JSON.stringify({ type: 'ACK', payload: acks }));
}