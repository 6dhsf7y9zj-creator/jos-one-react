# JOS One Build 02.2 — Backup & Restore

## Added
- Backup Centre tab.
- Import and validation of legacy JOS 1.1 JSON backups.
- Migration of legacy fields such as `expectedSale` and `storage`.
- Restore preview showing item, order and backup version counts.
- Export of current React data to a new JSON backup.
- Persistence of orders and settings alongside inventory.
- Automated migration tests, including duplicate-SKU protection.

## Compatibility
This build is designed for `JOS-One-backup-2026-08-01.json`, containing 24 stock items, 2 orders and settings.
