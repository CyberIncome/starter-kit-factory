# Factory CLI

The Starter Kit Factory CLI is a supported production interface for automation agents and operators. It uses the same local generator as the desktop dashboard.

## Development use

Run commands from the repository:

```powershell
npm run factory -- help
npm run factory -- validate -- --input examples\happy-tails.json
npm run factory -- create -- --input examples\happy-tails.json
```

## Installed application use

Run the installed app with `--cli`:

```powershell
& "C:\Program Files\Starter Kit Factory\Starter Kit Factory.exe" --cli create --input "C:\orders\happy-tails.json"
```

Every command writes JSON to standard output and uses a non-zero exit code on invalid input or incomplete output.

## Commands

### `validate`

Checks an order JSON file without generating files.

```powershell
npm run factory -- validate -- --input examples\happy-tails.json
```

### `create`

Generates working files, PDFs, and a customer-delivery ZIP. The output defaults to `Documents\Starter Kit Factory\Generated Kits`.

```powershell
npm run factory -- create -- --input examples\happy-tails.json
npm run factory -- create -- --input examples\happy-tails.json --output C:\customer-kits
```

### `preview`

Generates working files and PDFs without a delivery ZIP. It is useful for proofing an order before delivery.

```powershell
npm run factory -- preview -- --input examples\happy-tails.json
```

### `inspect`

Checks that an already-generated kit contains every required deliverable.

```powershell
npm run factory -- inspect -- --kit "C:\customer-kits\Happy-Tails-Dog-Walking-Starter-Kit" --business-name "Happy Tails Dog Walking"
```

### `list-orders`

Returns the local order history created by the dashboard and CLI.

```powershell
npm run factory -- list-orders
```

### `backup`

Copies locally saved order history and generated kits to a requested location.

```powershell
npm run factory -- backup -- --destination D:\Starter-Kit-Backups
```

## Automation rules

- Use `validate` before `create`.
- Supply JSON that conforms to the example structure.
- Treat warnings as review prompts and errors as hard stops.
- The CLI never sends Etsy messages, emails, uploads files, or publishes websites.
- An agent should return the generated ZIP for human review/delivery unless explicit delivery automation is added later.
