# landroid_monitor

Inspired by landroid ioBroker plugin.

This Node Service just monitors the worx MQTT Server and partially forwards events to a local MQTT server. 

To run: 
- Clone the repo into a folder. 
- Edit the settings.json.example with your account data and local MQTT Server address. Rename it to settings.json.
- Perform a 'npm install' to install dependencies.  
- Run the service by using 'node app.js'

I recommend usage of processmanager pm2 to restart the service on errors.