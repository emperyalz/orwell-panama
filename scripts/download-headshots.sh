#!/bin/bash
# Download headshots from Asamblea Nacional using thumbnail URLs (full-size 404s)
# Also downloads president photo from presidencia.gob.pa

DEST_DIR="$(dirname "$0")/../public/images/headshots"
DB_FILE="$(dirname "$0")/../../orwell-discovery/data/verified/FINAL-DATABASE.json"
PHOTO_MAP="$(dirname "$0")/../../orwell-discovery/data/gov-official/asamblea-photo-mapping.json"

mkdir -p "$DEST_DIR"

echo "=== Downloading Headshots ==="

# Extract politician IDs and their Asamblea numeric IDs from photo mapping
# Use thumbnail URL pattern: /Uploads/diputado/foto/{ID}/publicacion_{ID}.jpg
python3 -c "
import json, os

db = json.load(open('$DB_FILE'))
photo_map = json.load(open('$PHOTO_MAP'))

# Build lookup from photo mapping (name -> asamblea_id)
asamblea_lookup = {}
for dep in photo_map:
    asamblea_lookup[dep['asamblea_id']] = dep

# Match politicians to their Asamblea IDs via official_image_url
commands = []
for p in db['politicians']:
    url = p.get('official_image_url', '')
    dest = os.path.join('$DEST_DIR', f\"{p['id']}.jpg\")

    if os.path.exists(dest):
        continue

    if 'asamblea.gob.pa' in url:
        # Extract ID from URL like: .../imagenes/49/publicacion_49_0.jpg
        parts = url.split('/')
        for i, part in enumerate(parts):
            if part == 'imagenes' and i + 1 < len(parts):
                asamblea_id = parts[i + 1]
                thumb_url = f'https://www.asamblea.gob.pa/Uploads/diputado/foto/{asamblea_id}/publicacion_{asamblea_id}.jpg'
                print(f'{thumb_url}|{dest}|{p[\"id\"]} {p[\"name\"]}')
                break
    elif 'presidencia.gob.pa' in url:
        print(f'{url}|{dest}|{p[\"id\"]} {p[\"name\"]}')
" | while IFS='|' read -r url dest label; do
    echo "  Downloading: $label"
    curl -sL -o "$dest" "$url" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -H "Referer: https://www.asamblea.gob.pa/" \
        -H "Accept: image/webp,image/apng,image/*,*/*;q=0.8"

    # Check if download succeeded (file > 1KB)
    if [ -f "$dest" ] && [ "$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest" 2>/dev/null)" -gt 1000 ]; then
        echo "    ✅ OK"
    else
        echo "    ❌ Failed"
        rm -f "$dest"
    fi
    sleep 0.3
done

echo ""
echo "=== Results ==="
count=$(ls -1 "$DEST_DIR"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
echo "Total headshots downloaded: $count"
