import { OAuth2Client } from 'google-auth-library';

const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
};

// Create OAuth2 client for token verification
export const googleOAuthClient = new OAuth2Client(googleConfig.clientId);

export default googleConfig;
