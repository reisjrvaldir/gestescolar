#!/bin/sh
PORT=${PORT:-9000}
echo "GestEscolar listening on http://localhost:$PORT/"
exec "/c/Program Files/Git/usr/bin/perl" "C:/Users/USER/Documents/Projetos/gestescolar/serve.pl"
