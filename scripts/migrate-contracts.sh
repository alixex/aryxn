#!/bin/bash

# Configuration
TARGET_REPO="git@github.com:ranuts/contracts.git"
TEMP_DIR="temp_contracts_migration"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Contracts Migration to Private Repo (Invisible Mode)...${NC}"

# 1. Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Your git working tree is not clean. Please commit or stash changes before running this script.${NC}"
  exit 1
fi

# 2. Confirm with user
echo -e "${YELLOW}This script will:${NC}"
echo "1. Clone ${TARGET_REPO} to a temporary directory."
echo "2. Copy 'packages/contracts-ethereum' and 'packages/contracts-solana' to it."
echo "3. Push the changes to the private repository."
echo "4. DELETE the original directories from this local repository."
echo "5. Add 'contracts/' to .gitignore to make it INVISIBLE to others."
echo "6. Clone the private repo back to 'contracts' for YOU."
echo -e "${RED}WARNING: History for these directories will be preserved in the OLD repo but will strictly be a new commit in the NEW repo.${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
fi

# 3. Clone target repo
echo -e "${GREEN}Cloning target repository...${NC}"
rm -rf $TEMP_DIR
git clone $TARGET_REPO $TEMP_DIR

if [ ! -d "$TEMP_DIR" ]; then
    echo -e "${RED}Failed to clone repository. Check your SSH keys and access rights.${NC}"
    exit 1
fi

# 4. Copy files
echo -e "${GREEN}Copying contract files...${NC}"
mkdir -p $TEMP_DIR/contracts-ethereum
mkdir -p $TEMP_DIR/contracts-solana

if [ -d "packages/contracts-ethereum" ]; then
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'artifacts' --exclude 'cache' --exclude 'coverage' packages/contracts-ethereum/ $TEMP_DIR/contracts-ethereum/
fi

if [ -d "packages/contracts-solana" ]; then
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'target' --exclude 'coverage' packages/contracts-solana/ $TEMP_DIR/contracts-solana/
fi

# 5. Push to private repo
echo -e "${GREEN}Pushing to private repository...${NC}"
cd $TEMP_DIR
git add .
git commit -m "Initial contracts migration from main repo" || echo "Nothing to commit"
git push origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push to remote repository. Aborting.${NC}"
    cd ..
    rm -rf $TEMP_DIR
    exit 1
fi
cd ..

# 6. Cleanup temp dir
rm -rf $TEMP_DIR

# 7. Remove local directories
echo -e "${GREEN}Removing local contract directories...${NC}"
rm -rf packages/contracts-ethereum
rm -rf packages/contracts-solana

# 8. Update .gitignore
if ! grep -q "contracts/" .gitignore; then
    echo -e "${GREEN}Adding contracts/ to .gitignore...${NC}"
    echo -e "\n# Private Contracts\ncontracts/" >> .gitignore
else
    echo -e "${YELLOW}.gitignore already contains contracts/${NC}"
fi

# 9. Clone back for local user
echo -e "${GREEN}Cloning private repo to contracts (Local Only)...${NC}"
mkdir -p contracts
git clone $TARGET_REPO contracts

echo -e "${GREEN}Migration complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run 'pnpm install'."
echo "2. Commit your changes (including the modified .gitignore)."
