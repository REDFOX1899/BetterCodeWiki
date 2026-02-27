/**
 * WebSocket client for chat completions
 * This replaces the HTTP streaming endpoint with a WebSocket connection
 */

// Get the server base URL from environment or use default
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

// Convert HTTP URL to WebSocket URL, optionally appending an auth token
const getWebSocketUrl = (token?: string) => {
  const baseUrl = SERVER_BASE_URL;
  // Replace http:// with ws:// or https:// with wss://
  const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
  const url = `${wsBaseUrl}/ws/chat`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  repo_url: string;
  messages: ChatMessage[];
  filePath?: string;
  token?: string;
  type?: string;
  provider?: string;
  model?: string;
  language?: string;
  excluded_dirs?: string;
  excluded_files?: string;
}

/**
 * Creates a WebSocket connection for chat completions
 * @param request The chat completion request
 * @param onMessage Callback for received messages
 * @param onError Callback for errors
 * @param onClose Callback for when the connection closes
 * @param authToken Optional Clerk JWT token for authenticated WebSocket connections
 * @returns The WebSocket connection
 */
export const createChatWebSocket = (
  request: ChatCompletionRequest,
  onMessage: (message: string) => void,
  onError: (error: Event) => void,
  onClose: () => void,
  authToken?: string
): WebSocket => {
  // Create WebSocket connection (with auth token if provided)
  const ws = new WebSocket(getWebSocketUrl(authToken));
  
  // Set up event handlers
  ws.onopen = () => {
    console.log('WebSocket connection established');
    // Send the request as JSON
    ws.send(JSON.stringify(request));
  };
  
  ws.onmessage = (event) => {
    // Call the message handler with the received text
    onMessage(event.data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    onError(error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket connection closed');
    onClose();
  };
  
  return ws;
};

/**
 * Closes a WebSocket connection
 * @param ws The WebSocket connection to close
 */
export const closeWebSocket = (ws: WebSocket | null): void => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
};

// --- Diagram Explain WebSocket ---

const getDiagramExplainWebSocketUrl = (token?: string) => {
  const baseUrl = SERVER_BASE_URL;
  const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
  const url = `${wsBaseUrl}/ws/diagram/explain`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

export interface DiagramExplainRequest {
  repo_url: string;
  type?: string;
  node_id: string;
  node_label: string;
  node_technology?: string;
  node_files?: string[];
  node_description?: string;
  diagram_context?: string;
  provider?: string;
  model?: string;
  language?: string;
  token?: string;
}

/**
 * Creates a WebSocket connection for diagram node AI explanations
 * @param authToken Optional Clerk JWT token for authenticated WebSocket connections
 */
export const createDiagramExplainWebSocket = (
  request: DiagramExplainRequest,
  onMessage: (message: string) => void,
  onError: (error: Event) => void,
  onClose: () => void,
  authToken?: string
): WebSocket => {
  const ws = new WebSocket(getDiagramExplainWebSocketUrl(authToken));

  ws.onopen = () => {
    ws.send(JSON.stringify(request));
  };

  ws.onmessage = (event) => {
    onMessage(event.data);
  };

  ws.onerror = (error) => {
    console.error('Diagram explain WebSocket error:', error);
    onError(error);
  };

  ws.onclose = () => {
    onClose();
  };

  return ws;
};
