cd /root/Code/line-sticker

echo "Total: `ls files |wc -l` packs"
du -hd1 files |sort -hr |head -n5

find files/ -mmin +5 -name file.zip -delete
find files/ -mmin +5 -name "origin-*" -delete
find files/ -mmin +5 -name "temp-*" -delete
find files/ -mmin +5 -name "sticker-*" -delete

echo
echo "Done!"
du -hd1 files |sort -hr |head -n5
