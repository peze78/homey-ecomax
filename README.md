\# ecoMAX Controller for Homey



A Homey Pro integration for heating systems using ecoMAX controllers through the ecoNET24 cloud service.



The app reads temperatures, pump states and fan information from the heating controller and makes the values available in Homey.



> This is an independent community project and is not affiliated with Baxi, Plum or Athom.



\## Features



\- Boiler temperature

\- Flue gas temperature

\- Outdoor temperature

\- Upper, middle and lower buffer tank temperatures

\- Heating circuit 1 supply temperature

\- Heating circuit 1 target temperature

\- Optional support for heating circuit 2

\- Heating circuit pump status

\- Hot water pump status

\- Circulation pump status

\- Flue gas fan status

\- Flue gas fan output in percent

\- Selectable sensors in the device settings

\- Automatic reconnection to ecoNET24

\- Updates every 60 seconds



\## Verified installation



The app has currently been tested with:



\- \*\*Boiler:\*\* Baxi Excellent 40 Lambda

\- \*\*Internet module:\*\* Baxi Internet Module ecoNET 300 for Excellent 40 Lambda

\- \*\*Controller:\*\* ecoMAX 860D1-H

\- \*\*Connection:\*\* ecoNET24

\- \*\*Homey:\*\* Homey Pro



Other ecoMAX controllers and heating systems may work, but have not yet been verified.



\## Requirements



\- Homey Pro

\- An ecoMAX controller connected to ecoNET24

\- A working ecoNET24 user account

\- The controller UID shown in ecoNET24



\## Installation during development



Install the Homey CLI and Docker Desktop, then clone the repository:



```bash

git clone https://github.com/peze78/homey-ecomax.git

cd homey-ecomax

npm install

homey app run

