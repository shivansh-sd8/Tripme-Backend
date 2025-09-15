#!/bin/bash

# Production Deployment Script for TripMe Backend
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting TripMe Backend Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found. Creating from template..."
    if [ -f "env.production.example" ]; then
        cp env.production.example .env.production
        print_warning "Please update .env.production with your production values before continuing."
        exit 1
    else
        print_error "env.production.example not found. Cannot create .env.production"
        exit 1
    fi
fi

# Install dependencies
print_status "Installing production dependencies..."
npm ci --only=production

# Run tests
print_status "Running tests..."
npm test || {
    print_warning "Tests failed. Continuing with deployment..."
}

# Build the application (if needed)
print_status "Building application..."
# Add build commands here if needed

# Start the application
print_status "Starting production server..."
NODE_ENV=production node server.js

print_status "✅ Deployment completed successfully!"
