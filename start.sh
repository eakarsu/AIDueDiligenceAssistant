#!/bin/bash

# AI Due Diligence Assistant - Start Script
# This script cleans up ports, sets up the database, seeds data, and starts the application
# with hot-reload monitoring for code changes

set -e

echo "=========================================="
echo "   AI Due Diligence Assistant"
echo "   M&A Analysis Platform"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Default values (NOT using port 5000)
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
DB_NAME=${DB_NAME:-duediligence_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo -e "${BLUE}[INFO]${NC} Cleaning up used ports..."

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}[WARN]${NC} Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Clean up ports (not port 5000 as requested, and not 5432 for postgres)
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

echo -e "${GREEN}[OK]${NC} Ports cleaned"

# Check if PostgreSQL is running
echo -e "${BLUE}[INFO]${NC} Checking PostgreSQL connection..."

# Try to connect to PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} PostgreSQL client (psql) not found. Please install PostgreSQL."
    exit 1
fi

# Wait for PostgreSQL to be ready
MAX_RETRIES=10
RETRY_COUNT=0
while ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c '\q' 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}[ERROR]${NC} Could not connect to PostgreSQL. Make sure PostgreSQL is running."
        echo -e "${YELLOW}[TIP]${NC} On macOS, run: brew services start postgresql"
        echo -e "${YELLOW}[TIP]${NC} On Linux, run: sudo systemctl start postgresql"
        exit 1
    fi
    echo -e "${YELLOW}[WAIT]${NC} Waiting for PostgreSQL... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo -e "${GREEN}[OK]${NC} PostgreSQL is running"

# Create database if it doesn't exist
echo -e "${BLUE}[INFO]${NC} Setting up database..."

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

echo -e "${GREEN}[OK]${NC} Database '$DB_NAME' ready"

# Install backend dependencies
echo -e "${BLUE}[INFO]${NC} Installing backend dependencies..."
cd "$PROJECT_ROOT/backend"
npm install --silent

# Seed the database
echo -e "${BLUE}[INFO]${NC} Seeding database with sample data..."
echo -e "${CYAN}[INFO]${NC} This includes:"
echo "         - 16 Companies"
echo "         - 17 Financial Analysis records"
echo "         - 16 News articles"
echo "         - 16 Risk Assessments"
echo "         - 16 Red Flags"
echo "         - 16 Market Analysis records"
echo "         - 17 Competitor Intelligence records"
echo "         - 16 Legal Compliance records"
echo "         - 17 Management Assessments"
echo "         - 16 Deal Pipeline records"
echo -e "${PURPLE}[AI FEATURES]${NC} Seeding new AI feature data:"
echo "         - 16 AI Risk Scores"
echo "         - 16 AI Synergy Calculations"
echo "         - 16 AI Valuation Models"
echo "         - 16 AI Red Flag Detections"
echo "         - 16 AI Integration Plans"
node seed.js

echo -e "${GREEN}[OK]${NC} Database seeded with sample data"

# Install frontend dependencies
echo -e "${BLUE}[INFO]${NC} Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install --silent

echo -e "${GREEN}[OK]${NC} Dependencies installed"

# Start the application with hot-reload
echo ""
echo -e "${BLUE}=========================================="
echo -e "   Starting Application with Hot-Reload"
echo -e "==========================================${NC}"
echo ""

# Start backend with nodemon for hot-reload (watching for changes)
echo -e "${BLUE}[INFO]${NC} Starting backend server on port $BACKEND_PORT with hot-reload..."
cd "$PROJECT_ROOT/backend"
npx nodemon --watch . --ext js,json server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Backend failed to start"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Backend running on http://localhost:$BACKEND_PORT"
echo -e "${CYAN}[HOT-RELOAD]${NC} Backend will automatically restart when files change"

# Start frontend with hot-reload (built-in with Create React App)
echo -e "${BLUE}[INFO]${NC} Starting frontend on port $FRONTEND_PORT with hot-reload..."
cd "$PROJECT_ROOT/frontend"
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo -e "${GREEN}=========================================="
echo -e "   Application Started Successfully!"
echo -e "==========================================${NC}"
echo ""
echo -e "   Frontend: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "   Backend:  ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo ""
echo -e "   ${YELLOW}Demo Credentials:${NC}"
echo -e "   Email:    ${GREEN}admin@duediligence.com${NC}"
echo -e "   Password: ${GREEN}Demo123!${NC}"
echo ""
echo -e "   ${PURPLE}AI Model:${NC} ${CYAN}${OPENROUTER_MODEL:-anthropic/claude-haiku-4.5}${NC}"
echo ""
echo -e "   ${CYAN}HOT-RELOAD ENABLED:${NC}"
echo -e "   - Backend changes will auto-restart the server"
echo -e "   - Frontend changes will auto-refresh the browser"
echo ""
echo -e "   ${PURPLE}NEW AI FEATURES:${NC}"
echo -e "   - AI Risk Scorer      - Quantify deal risks automatically"
echo -e "   - AI Synergy Calculator - Estimate merger synergies"
echo -e "   - AI Valuation Modeler  - Multiple valuation methods"
echo -e "   - AI Red Flag Detector  - Identify deal breakers"
echo -e "   - AI Integration Planner - Post-merger roadmap"
echo ""
echo -e "   ${YELLOW}Press Ctrl+C to stop the application${NC}"
echo ""

# Handle graceful shutdown
cleanup() {
    echo ""
    echo -e "${BLUE}[INFO]${NC} Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    # Kill any nodemon processes
    pkill -f "nodemon.*server.js" 2>/dev/null || true
    echo -e "${GREEN}[OK]${NC} Application stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
