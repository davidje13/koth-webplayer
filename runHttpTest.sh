# This script uses a node package (http-server) to run the webplayer on
# localhost. This should not be required for typical development, but is used
# to debug browser issues with security policies & http/https access in the
# core framework.

# usage:
# ./runHttpTest.sh
# ./runHttpTest.sh -S

if ! which http-server >/dev/null 2>&1; then
	npm install http-server -g;
fi;

if [[ "$1" == "-S" ]]; then
	if ! [[ -f cert.pem ]] || ! openssl x509 -checkend 3600 -noout -in cert.pem; then
		openssl req -newkey rsa:2048 -new -nodes -x509 -days 1 -keyout key.pem -out cert.pem;
	fi;
	http-server -S -C cert.pem;
else
	http-server;
fi;
