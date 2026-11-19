#!/usr/bin/env sh
set -eu
node --version
npm test
npm run doctor
printf '%s\n' 'GovernSutra AI starter checks passed. No global installation was performed.'
