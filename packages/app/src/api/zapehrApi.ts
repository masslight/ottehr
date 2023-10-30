export interface ZapehrSearchParameter {
  key: string;
  value: string;
}

class API {
  async getTwilioToken(roomName: string): Promise<string | null> {
    try {
      // For development, we can use the local express server to generate a token
      const response = await fetch('http://localhost:5000/join-room', {
        body: JSON.stringify({ roomName }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const { token } = await response.json();
      return token;
    } catch (error) {
      console.error('Error fetching token:', error);
      return null;
    }
  }
}

export const zapehrApi = new API();
