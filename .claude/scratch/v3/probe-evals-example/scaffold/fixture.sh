#!/usr/bin/env bash
set -e
git init -q .
echo "SCAFFOLD-MARKER-4412" > hello.txt
git add hello.txt
git -c user.name=probe -c user.email=probe@example.com commit -q -m "fixture"
