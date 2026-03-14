#!/bin/bash

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT")

# check root path permissions (read, write)
if [ ! -r $ROOTPATH/ ] || [ ! -w $ROOTPATH/ ]
then
    echo "WARNING: Insufficient permissions: $ROOTPATH"
    echo "Run `install.sh` to reset permissions"
fi

$ROOTPATH/app/node -e "eval(require('$ROOTPATH/app/boot.node').run())" $ROOTPATH/app/EFR.zip -RootPath $ROOTPATH
