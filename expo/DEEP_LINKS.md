# Deep Link Setup

FlashQuest uses deep links for arena invite codes: `flashquest://join/{code}`

For universal links, the domain flashquest.net must serve two verification files.

## Files to Host

Both files are in `public/.well-known/`. Deploy them so they are accessible at:

- `https://flashquest.net/.well-known/apple-app-site-association`
- `https://flashquest.net/.well-known/assetlinks.json`

## Requirements

**Apple (AASA file):**
- Must be served over HTTPS with a valid certificate
- Content-Type must be `application/json`
- Must NOT have a `.json` extension in the URL
- Replace `YOUR_APPLE_TEAM_ID` with your Team ID from Apple Developer account

**Android (Asset Links):**
- Must be served over HTTPS
- Content-Type must be `application/json`
- Replace `YOUR_SHA256_CERT_FINGERPRINT` with your signing key fingerprint

## Hosting Options

**Vercel:** Drop the `public/` directory into a Vercel project pointed at flashquest.net.

**GitHub Pages:** Push the `.well-known/` directory to a repo with GitHub Pages enabled on a custom domain.

**Netlify:** Add a `_redirects` or `netlify.toml` to serve the files. Ensure the AASA file has no `.json` extension.

## Testing

After deploying, verify:

```bash
curl -I https://flashquest.net/.well-known/apple-app-site-association
# Should return 200 with content-type: application/json

curl https://flashquest.net/.well-known/assetlinks.json
# Should return the JSON with your package name and fingerprint
```

On iOS, use Apple's validator:
https://search.developer.apple.com/apple-app-site-association-validator/

## Expo Config

The `app.json` already has:
- `"scheme": "flashquest"` for `flashquest://` links
- `"origin": "https://flashquest.net/"` for universal links
- The `join/[code].tsx` route handles incoming invite codes
