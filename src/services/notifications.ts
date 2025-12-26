// 👇 CHANGE THIS IMPORT 👇
import { fcm } from "../firebase/admin"; // Importing from YOUR existing file
import { storage } from "../db/storage";
import { db } from "../db/db";
import { notifications } from "../db/schema"; 

export async function sendNotification(
  recipientUserId: number,
  title: string,
  body: string,
  type: string,          
  referenceId: string    
) {
  // 1. SAVE to Database (Action Center)
  await db.insert(notifications).values({
    recipientUserId,
    title,
    body,
    type,
    referenceId,
    isRead: false
  });
  console.log(`✅ Notification Saved to Ledger for User ${recipientUserId}`);

  // 2. Fetch User Address
  const user = await storage.getUser(recipientUserId);

  if (!user || !user.fcmToken) {
    console.log(`⚠️ User ${recipientUserId} has no FCM Token. Skipping Push.`);
    return; 
  }

  // 3. Construct Message
  const message = {
    token: user.fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      type: type, 
      referenceId: referenceId,
    },
    android: {
      priority: "high" as const, 
    },
  };

  // 4. Send via REUSED Firebase Admin
  try {
    await fcm.send(message);
    console.log(`🚀 Push Sent to User ${recipientUserId}`);
  } catch (error: any) {
    console.error(`❌ FCM Failed: ${error.message}`);
  }
}
export async function sendSilentDataMessage(
  fcmToken: string,
  dataPayload: { [key: string]: string }, // Data to be sent to the client app
  consoleLogMessage: string = "Silent data message sent"
) {
  const message = {
    token: fcmToken,
    data: dataPayload, // ONLY data payload for silent messages
    android: {
      priority: "high" as const, // High priority for critical background signals
    },
    apns: { // Apple Push Notification Service configuration
      headers: {
        'apns-priority': '5', // '5' for background content, '10' for immediate/user-visible
        'apns-push-type': 'background' // Specifies it's a background push
      },
      payload: {
        aps: {
          'content-available': 1 // Essential for iOS silent pushes to wake the app
        }
      }
    }
  };

  try {
    await fcm.send(message);
    console.log(`🚀 ${consoleLogMessage}`);
  } catch (error: any) {
    console.error(`❌ FCM Silent Message Failed for token ${fcmToken}: ${error.message}`);
  }
}