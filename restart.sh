for port in 4002 3002 4001 3001 4000; do lsof -ti :$port | xargs -r kill -9; done
npm run apps:start