#!/usr/bin/env node

// One-time OAuth2 setup script for MCP
// Run this once to get refresh tokens, then use those in .env.local

import { google } from 'googleapis';
import * as readline from 'readline';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

async function main() {
  console.log('🔐 MCP OAuth2 Setup');
  console.log('This will help you get OAuth2 tokens for Gmail and Calendar APIs');
  
  // Check if we have OAuth2 credentials
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log('\n❌ Missing OAuth2 credentials!');
    console.log('Please set up OAuth2 credentials in Google Cloud Console:');
    console.log('1. Go to https://console.cloud.google.com/apis/credentials');
    console.log('2. Create OAuth 2.0 Client IDs');
    console.log('3. Set application type to "Desktop application"');
    console.log('4. Add to your .env.local:');
    console.log('   GOOGLE_CLIENT_ID=your_client_id');
    console.log('   GOOGLE_CLIENT_SECRET=your_client_secret');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000/oauth2callback'
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Forces refresh token generation
    scope: SCOPES,
  });

  console.log('\n🌐 Please visit this URL to authorize the application:');
  console.log(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('\n📝 Paste the authorization code here: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ Success! Got tokens:');
    console.log('Access Token:', tokens.access_token ? '✓' : '✗');
    console.log('Refresh Token:', tokens.refresh_token ? '✓' : '✗');
    
    if (!tokens.refresh_token) {
      console.log('\n⚠️  No refresh token received. This might happen if you\'ve already authorized this app.');
      console.log('Try revoking access at https://myaccount.google.com/permissions and run this again.');
    }

    // Update .env.local
    const envPath = '.env.local';
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Remove existing OAuth2 tokens if present
    envContent = envContent.replace(/^GOOGLE_ACCESS_TOKEN=.*$/m, '');
    envContent = envContent.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, '');
    
    // Add new tokens
    envContent += `\nGOOGLE_ACCESS_TOKEN=${tokens.access_token}`;
    if (tokens.refresh_token) {
      envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    
    console.log('\n📁 Updated .env.local with OAuth2 tokens');
    console.log('🚀 You can now use Gmail and Calendar tools with OAuth2!');
    console.log('\n💡 To switch to OAuth2, comment out the service account line:');
    console.log('   # GOOGLE_SERVICE_ACCOUNT_PATH=...');
    
  } catch (error) {
    console.error('\n❌ Error getting tokens:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);