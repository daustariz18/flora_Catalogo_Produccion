@echo off
cd /d "%~dp0"
"%~dp0node_modules\.bin\vite.cmd" --host=127.0.0.1 --port=5175 --strictPort --configLoader=native > "%~dp0vite5175.log" 2>&1
