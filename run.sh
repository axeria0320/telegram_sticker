#!/bin/bash

export NTBA_FIX_319=true
export NTBA_FIX_350=true

while true; do
	clear
	date
	log=logs/log_`date '+%m-%d_%H-%M-%S'`
	export NODE_REDIRECT_WARNINGS=${log}.err
	nice -n 19 node \
		--trace-warnings \
		. \
		|tee -a $log
	for _ in {1..3}; do
		echo -e "CRASHED\x07"
		sleep 1
	done
	sleep 2
done
