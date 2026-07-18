import { google } from 'googleapis'
import http from 'http'
import { dbOps } from './database'

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

const FALLBACK_CLIENT_ID = '202264815644.apps.googleusercontent.com'
const FALLBACK_CLIENT_SECRET = 'X4Z3ca8xfWDb1Voo-F9a7ZxJ'

let oauth2Client: any = null

export function clearOAuth2Client(): void {
  oauth2Client = null
}

export function getOAuth2Client(): any {
  if (oauth2Client) return oauth2Client

  const config = dbOps.getSetting<OAuthConfig | null>('google_oauth_config', null)
  let clientId = config?.clientId
  let clientSecret = config?.clientSecret

  if (!clientId || !clientSecret) {
    clientId = FALLBACK_CLIENT_ID
    clientSecret = FALLBACK_CLIENT_SECRET
  }

  const tokens = dbOps.getSetting<any>('google_oauth_tokens', null)

  oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    config?.redirectUri || 'http://localhost:8432/oauth2callback'
  )

  if (tokens) {
    oauth2Client.setCredentials(tokens)
  }

  // Set up auto-refresh token listener
  oauth2Client.on('tokens', (newTokens: any) => {
    const currentTokens = dbOps.getSetting<any>('google_oauth_tokens', {})
    const updatedTokens = { ...currentTokens, ...newTokens }
    dbOps.setSetting('google_oauth_tokens', updatedTokens)
  })

  return oauth2Client
}

export function startOAuthFlow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const config = dbOps.getSetting<OAuthConfig | null>('google_oauth_config', null)
    let clientId = config?.clientId
    let clientSecret = config?.clientSecret

    if (!clientId || !clientSecret) {
      clientId = FALLBACK_CLIENT_ID
      clientSecret = FALLBACK_CLIENT_SECRET
    }

    const client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:8432/oauth2callback'
    )

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent'
    })

    // Start local server to capture redirect
    const server = http.createServer(async (req, res) => {
      if (req.url?.startsWith('/oauth2callback')) {
        const urlParams = new URL(req.url, 'http://localhost:8432')
        const code = urlParams.searchParams.get('code')

        if (code) {
          try {
            const { tokens } = await client.getToken(code)
            client.setCredentials(tokens)

            // Save tokens and config update
            dbOps.setSetting('google_oauth_tokens', tokens)
            oauth2Client = client

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <body style="font-family: sans-serif; background: #0f0f14; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
                  <div style="background: #1c1c24; padding: 2rem; border-radius: 12px; border: 1px solid #2f2f3d; text-align: center;">
                    <h1 style="color: #a855f7;">✓ Authentication Successful</h1>
                    <p style="margin-top: 1rem; color: #9ca3af;">You can now close this tab and return to Smart Notes.</p>
                  </div>
                </body>
              </html>
            `)

            server.close()
            resolve('success')
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(`<h1>Authentication Failed</h1><p>${err.message}</p>`)
            server.close()
            reject(err)
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Authorization code missing</h1>')
          server.close()
          reject(new Error('Auth code missing'))
        }
      }
    })

    server.listen(8432, () => {
      console.log('OAuth helper listening on port 8432')
    })

    server.on('error', (err) => {
      reject(err)
    })

    // Return the URL so the UI can open it in browser
    resolve(authUrl)
  })
}

export function isGoogleAuthenticated(): boolean {
  const client = getOAuth2Client()
  if (!client) return false
  const tokens = dbOps.getSetting<any>('google_oauth_tokens', null)
  return !!(tokens && tokens.access_token)
}

export function logoutGoogle(): void {
  dbOps.setSetting('google_oauth_tokens', null)
  oauth2Client = null
}

export async function listGoogleDriveFolders(): Promise<any[]> {
  const authClient = getOAuth2Client()
  if (!authClient) throw new Error('Not authenticated with Google.')

  const drive: any = google.drive({ version: 'v3', auth: authClient })
  const response = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 100
  })

  return response.data.files || []
}

export async function createGoogleDriveFolder(folderName: string): Promise<any> {
  const authClient = getOAuth2Client()
  if (!authClient) throw new Error('Not authenticated with Google.')

  const drive: any = google.drive({ version: 'v3', auth: authClient })
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  }

  const file = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name'
  })

  if (!file.data.id) throw new Error('Failed to create folder in Google Drive.')
  return { id: file.data.id, name: file.data.name || folderName }
}
