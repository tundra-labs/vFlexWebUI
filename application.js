(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
    const connectButton = document.querySelector("#connect");
    const statusDisplay = document.querySelector('#status');
    const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
    const voltageSelect = document.querySelector("#voltage_select");
    const programButton = document.querySelector("#program_button");
    const commandLine = document.querySelector("#command_line");
    let actualVoltage = null;
    let port;

    // Color ENUM
    const color = Object.freeze ({
      RED: 0,
      GREEN: 1, 
      BLUE: 2,
      OFF: 3
    });

    // Command ENUM
    const cmdCode = Object.freeze ({
      SETV: 0,
      GETUUID: 1,
      LED: 2,
      GETV: 3
    });

    // ConfirmationBlink Array
    let confBlink = [
      { color: color.OFF, timeMS: 100 },
      { color: color.GREEN, timeMS: 100 },
      { color: color.OFF, timeMS: 100 },
      { color: color.GREEN, timeMS: 100 }
    ];
    
    // errorBlink Array
    let errorBlink = [
      { color: color.OFF, timeMS: 100 },
      { color: color.RED, timeMS: 400 },
      { color: color.OFF, timeMS: 100 },
      { color: color.RED, timeMS: 400 }
    ];

    // Helper function to convert milliseconds to MSB and LSB
    function msToBytes(ms) {
      const MSB = (ms >> 8) & 0xFF; // Most Significant Byte
      const LSB = ms & 0xFF; // Least Significant Byte
      console.log(ms, MSB, LSB, MSB.toString(16), LSB.toString(16), ms.toString(16));
      return [MSB, LSB];
    }

    // LED Blink Helper Function
    function ledBlink (n_cycles, ledArr) {

      let flashArrayLength = (4 + (ledArr.length * 3));

      var led_flash_message_array = new Uint8Array(flashArrayLength); //setting array length
      led_flash_message_array.set([flashArrayLength, cmdCode.LED, n_cycles, ledArr.length], 0);


      let i = 4;

      for(let k = 0; k < ledArr.length; k++, i++){
        led_flash_message_array[i] = ledArr[k].color; // send color code
        i++;
        let byteTime = msToBytes(ledArr[k].timeMS); //Convert MSB and LSB to byteTime array
        led_flash_message_array[i] = byteTime[0]; //MSB
        i++;
        led_flash_message_array[i] = byteTime[1]; //LSB
      }
    
      console.log(led_flash_message_array);
      port.send(led_flash_message_array);

    }

    // Send Back Voltage Setting
    function getVoltage () {
      var get_voltage_setting_message_array = new Uint8Array(2);
      get_voltage_setting_message_array[0] = 2; // usb message len
      get_voltage_setting_message_array[1] = cmdCode.GETV; // cmd code
      console.log(get_voltage_setting_message_array);
      port.send(get_voltage_setting_message_array);
      return actualVoltage;
    }

    function setVoltage (selectedVoltage) {
      var array = new Uint8Array(3);
      array[0] = 3; // msg len
      array[1] = cmdCode.SETV; // command code set voltage
      array[2] = selectedVoltage;
      console.log(array);

      port.send(array);
    }

    function connect() {
      port.connect().then(() => {
        statusDisplay.textContent = '';
        connectButton.textContent = 'Disconnect';
        getVoltage();
        setTimeout(() => {
          statusDisplay.textContent = port.device_.productName + ' Connected: Programmed to ' + actualVoltage +'V';        
        }, 10);
        console.log(actualVoltage);
        console.log(port.device_);
    
        // Show the voltage select and program button
        controls.style.display = 'block';
    
        port.onReceive = data => {
          let textDecoder = new TextDecoder();
          let command_code = data.getUint8(1); 
          switch (command_code) {
            case 0:
              break;
            case 1: // uuid
              let uuid_len = data.getUint8(0) - 2;
              let uuid = data.buffer.slice(2, data.getUint8(0));
              console.log(textDecoder.decode(uuid));
              break;
            case 2:
              break;
            case 3: // Voltage readback
              let voltage = (data.getUint8(2) << 24) | (data.getUint8(3) << 16) | (data.getUint8(4) << 8) | (data.getUint8(5) << 0);
              actualVoltage = voltage / 1000; // Store the actual voltage
              break;
            default:
              console.log("invalid usb incoming message. unexpected command code");
          }
        };
        port.onReceiveError = error => {
          console.error(error);
        };
      }, error => {
        statusDisplay.textContent = error;
      });
    }

    connectButton.addEventListener('click', function() {
      if (port) {
        port.disconnect();
        connectButton.textContent = 'Connect';
        statusDisplay.textContent = '';
        port = null;

        // Hide the voltage select and program button
        controls.style.display = 'none';

      } else {
        serial.requestPort().then(selectedPort => {
          port = selectedPort;
          connect();
        }).catch(error => {
          if (error.message.includes('No device selected')) {
            statusDisplay.textContent = 'No Device Selected.';
          } else {
            statusDisplay.textContent = error.message;
          }
        });
      }
    });

    programButton.addEventListener('click', function() {
      const selectedVoltage = parseInt(voltageSelect.value);
      
      //setting new Voltage
      setVoltage(selectedVoltage);

      //getting programmed voltage
      getVoltage();

      // Wait for a short time before checking the voltage
      setTimeout(() => {
        console.log("Actual Voltage after delay:", actualVoltage);

        if (actualVoltage === selectedVoltage) {
          console.log('Voltages match:', actualVoltage, selectedVoltage);
          
          //send confirmation blink
          ledBlink(2, confBlink);

          statusDisplay.textContent = 'Device Output Updated to ' + selectedVoltage + 'V';

        } else {
          console.log('Voltages do not match:', actualVoltage, selectedVoltage);

          //send error blink
          ledBlink(3, errorBlink);
        }

        
      }, 500); // Adjust the delay as necessary
    });
     

    commandLine.addEventListener("keypress", function(event) {
      if (event.keyCode === 13) {
        if (commandLine.value.length > 0) {
          addLine('sender_lines', commandLine.value);
          commandLine.value = '';
        }
      }

      port.send(new TextEncoder('utf-8').encode(String.fromCharCode(event.which || event.keyCode)));
    });

    navigator.usb.addEventListener('disconnect', event => {
      if (port && port.device_ && port.device_.productName.includes("Werewolf")) {
        const device = port.device_;
        port.disconnect();
        connectButton.textContent = 'Connect';
        statusDisplay.textContent = `Device ${device.productName} disconnected.`;
        port = null;

        // Hide the voltage select and program button
        controls.style.display = 'none';
      }
    });
  });
})();