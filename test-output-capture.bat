@echo off
echo This is a test batch file
echo Current directory: %CD%
git --version > test_output.txt 2>&1
echo Git version written to test_output.txt
type test_output.txt
pause
