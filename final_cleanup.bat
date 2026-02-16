@echo off
echo Copying neeraj-photo.jpg...
copy "portfolio-standalone\neeraj-photo.jpg" "neeraj-photo.jpg"

echo Deleting old game files...
del game.js
del world.js
del textures.js
del move_files.bat

echo Deleting portfolio-standalone directory...
rmdir /s /q "portfolio-standalone"

echo Cleanup complete!
pause
