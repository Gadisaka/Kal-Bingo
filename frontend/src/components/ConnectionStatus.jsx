// import { useState, useEffect } from "react";
// import { socketClient } from "../sockets/socket";

// export default function ConnectionStatus() {
//   const [connectionState, setConnectionState] = useState(
//     socketClient.getConnectionState()
//   );

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setConnectionState(socketClient.getConnectionState());
//     }, 500);
//     return () => clearInterval(interval);
//   }, []);

//   const getStatusColor = () => {
//     switch (connectionState) {
//       case "connected":
//         return "text-green-600";
//       case "connecting":
//         return "text-yellow-600";
//       case "disconnected":
//         return "text-red-600";
//       case "error":
//         return "text-red-600";
//       case "failed":
//         return "text-red-800";
//       default:
//         return "text-gray-600";
//     }
//   };

//   const getStatusText = () => {
//     switch (connectionState) {
//       case "connected":
//         return "🟢 Connected";
//       case "connecting":
//         return "🟡 Connecting...";
//       case "disconnected":
//         return "🔴 Disconnected";
//       case "error":
//         return "🔴 Connection Error";
//       case "failed":
//         return "🔴 Connection Failed";
//       default:
//         return "⚪ Unknown";
//     }
//   };

//   const handleReconnect = () => {
//     socketClient.reconnect();
//   };

//   return (
//     <div className="fixed top-4 right-4 bg-white p-3 rounded-lg shadow-lg border">
//       <div className={`font-semibold ${getStatusColor()}`}>
//         {getStatusText()}
//       </div>
//       {connectionState === "failed" && (
//         <button
//           onClick={handleReconnect}
//           className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
//         >
//           Retry Connection
//         </button>
//       )}
//     </div>
//   );
// }
