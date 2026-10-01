set -euo pipefail
mkdir -p dist-deployable
cp index.html 404.html manifest.webmanifest service-worker.js vercel.json dist-deployable/
cp -R assets templates dist-deployable/
touch dist-deployable/.nojekyll
printf '%s\n' \
  "commit=${GITHUB_SHA}" \
  "version=11.43.0" \
  "build=2026-09-25.37" \
  "validated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > dist-deployable/BUILD_INFO.txt
