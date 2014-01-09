#!/bin/sh

if [ $(ps aux | grep $USER | grep node | grep -v grep | wc -l | tr -s "\n") -eq 0 ]
then
        export PATH=/usr/local/bin:$PATH

        dir=$(cd `dirname "$0"` && pwd -P)
        logfile="$dir/../../log/access.log"
        logdir=$(dirname $logfile)
        mkdir -p $logdir
        forever start -l $logfile -a --sourceDir $dir/../js index.js 2>&1 &
fi

exit 1