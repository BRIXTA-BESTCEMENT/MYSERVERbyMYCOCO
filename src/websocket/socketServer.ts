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
  const port = Number(process.env.WSPORT) || 3000; 

  const wss = new WebSocketServer({ port });

  console.log(`✅ Geo-Tracking WebSocket Server running on port ${port}`);

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
        acks.push({ 
          opId: op.opId, 
          status: 'ALREADY_PROCESSED',
          serverSeq: existing.serverSeq 
        });
        continue;
      }

      // 2. Insert into 'journey_ops' (The Source of Truth)
      const [insertedOp] = await db.insert(journeyOps).values({
        opId: op.opId,
        journeyId: op.journeyId,
        userId: op.userId,
        type: op.type,
        payload: op.payload, // Storing full JSON payload
        createdAt: new Date(op.createdAt),
      }).returning({ serverSeq: journeyOps.serverSeq });

      // 3. Process Specific Logic (Read Models)
      if (op.type === 'START') {
        const { siteId, dealerId, siteName, destLat, destLng, pjpId } = op.payload;
        
        await db.insert(journeys).values({
          id: op.journeyId,
          userId: op.userId,
          startTime: new Date(op.createdAt),
          status: 'ACTIVE',
          siteName: siteName || 'N/A Site',
          pjpId: pjpId,
          siteId: siteId, 
          dealerId: dealerId,
          destLat: destLat ? destLat.toString() : null,
          destLng: destLng ? destLng.toString() : null,
          isSynced: true,
          updatedAt: new Date(),
        });

      } else if (op.type === 'MOVE') {
        const { latitude, longitude, speed, h3Index, accuracy, heading, altitude, batteryLevel } = op.payload;
        
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
            recordedAt: new Date(op.createdAt),
            isSynced: true
        });
        
        // Optional: Update total distance on Journey here if you want real-time stats

      } else if (op.type === 'STOP') {
        await db.update(journeys)
          .set({ 
            status: 'COMPLETED',
            endTime: new Date(op.createdAt),
            updatedAt: new Date()
          })
          .where(eq(journeys.id, op.journeyId));
      }

      // 4. Acknowledge with the REAL serverSeq
      acks.push({ 
        opId: op.opId, 
        status: 'OK', 
        serverSeq: insertedOp.serverSeq 
      });

    } catch (dbError) {
      console.error(`Failed to process op ${op.opId}:`, dbError);
      acks.push({ opId: op.opId, status: 'FAILED' });
    }
  }

  // Send ACKs back
  ws.send(JSON.stringify({ type: 'ACK', payload: acks }));
}