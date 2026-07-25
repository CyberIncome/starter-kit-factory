# Starter Kit Factory

A Windows desktop application for producing personalized, ready-to-deliver business starter kits without AI, Canva, or a browser dashboard.

## Current scope

Version 1 is a dog-walking starter-kit factory. It generates a local delivery folder and ZIP containing:

1. One-page website template
2. Logo pack
3. Invoice template
4. Service agreement template
5. Client intake form
6. Price sheet
7. Business card
8. Flyer
9. Launch checklist

The service agreement is deliberately marked as a starting template and must receive qualified legal review before commercial use.

## How it runs

- The installed application opens as its own Windows window.
- It does not start a localhost web server in production.
- Customer orders and generated kits stay on the operator's computer.
- Generated kits are saved to `Documents/Starter Kit Factory/Generated Kits`.

## Development

```powershell
npm install
npm run dev
npm test
npm run package:win
```

The production installer is written to `release/` and is intentionally ignored by Git. Publish that installer as a GitHub Release asset, not as a source-controlled repository file.

## Updates

Installed production builds are configured to check GitHub Releases for updates. Once the public `CyberIncome/starter-kit-factory` repository and its first Release are published, future releases can download and install from inside the application. Until that first release exists, the updater safely does nothing.

## Release safeguards

- Build a new installer with `npm run package:win`.
- Run `npm test` before each release.
- Publish with the GitHub release workflow so it creates the versioned `.exe`, `.blockmap`, and `latest.yml` updater metadata together.
- Obtain a Windows code-signing certificate before distribution beyond trusted family/internal users to reduce SmartScreen warnings.
