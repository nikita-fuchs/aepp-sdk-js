#!/bin/zsh

counter=0

while true
do
  echo "Running cycle: $counter ."
  # NODE_OPTIONS="--loader ts-node/esm" npx mocha ~/Documents/DAPPS/Aeternity/aepp-sdk-js/test/integration/channel.ts
  npx mocha ~/Documents/DAPPS/Aeternity/aepp-sdk-js/test/integration/channel.ts

  # Optional: Add a delay before restarting the command
  counter=counter+10
  sleep 10
done

