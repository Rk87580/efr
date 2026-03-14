#!/bin/bash

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT")

# check app path permissions
if [ ! -x $ROOTPATH/app/node ] || [ ! -x $ROOTPATH/run.sh ] || [ ! -r $ROOTPATH/app/ ] || [ ! -w $ROOTPATH/app/ ]
then
    echo "Setting app permissions..."
    chmod 774 $ROOTPATH/app
    chmod 754 $ROOTPATH/app/node
    chmod 644 $ROOTPATH/app/EFR.zip
    chmod 644 $ROOTPATH/app/boot.node
    chmod 644 $ROOTPATH/app/install.js
    chmod 644 $ROOTPATH/app/install.json
    chmod 754 $ROOTPATH/run.sh
fi

# check root path permissions (read, write)
if [ ! -r $ROOTPATH/ ] || [ ! -w $ROOTPATH/ ]
then
    echo "Setting $ROOTPATH permissions..."
    chmod 740 $ROOTPATH/
fi

$ROOTPATH/app/node $ROOTPATH/app/install.js $*
