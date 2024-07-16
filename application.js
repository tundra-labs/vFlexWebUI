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

    function connect() {
      port.connect().then(() => {
        statusDisplay.textContent = '';
        connectButton.textContent = 'Disconnect';
        statusDisplay.textContent = port.device_.productName + ' Connected';
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
      //console.log(selectedVoltage);

      var setVoltageArray = new Uint8Array(3);
      setVoltageArray[0] = 3; // msg len
      setVoltageArray[1] = 0; // command code set voltage
      setVoltageArray[2] = selectedVoltage;
      port.send(setVoltageArray);

      var getVoltageSettingArray = new Uint8Array(2);
      getVoltageSettingArray[0] = 2; // usb message len
      getVoltageSettingArray[1] = 3; // cmd code to read voltage
      console.log("Getting Updated Voltage...");
      port.send(getVoltageSettingArray); 

      // Wait for a short time before checking the voltage
      setTimeout(() => {
        console.log("Actual Voltage after delay:", actualVoltage);

        if (actualVoltage === selectedVoltage) {
          console.log('Voltages match:', actualVoltage, selectedVoltage);
          // Add your LED flash message or other logic here
          function msToBytes(ms) {
            const MSB = (ms >> 8) & 0xFF; // Most Significant Byte
            const LSB = ms & 0xFF; // Least Significant Byte
            return [MSB, LSB];
          }
  
          // Define your timings in milliseconds
          const onTime = 100; // 100 ms
          const offTime = 100; // 100 ms
  
          // Convert timings to bytes
          const onTimeBytes = msToBytes(onTime);
          const offTimeBytes = msToBytes(offTime);
  
          // Prepare the LED flash message
          var led_flash_message_array = new Uint8Array(10);
          led_flash_message_array[0] = 10; // usb message len
          led_flash_message_array[1] = 2; // cmd code
          led_flash_message_array[2] = 5; // n cycles: repeat led flash sequence
          led_flash_message_array[3] = 2; // seq len. on / off sequence = 2
          led_flash_message_array[4] = 3; // seq sel 0 enum: RED=0, GREEN, BLUE, OFF
          led_flash_message_array[5] = onTimeBytes[0]; // seq time 0 MSB
          led_flash_message_array[6] = onTimeBytes[1]; // seq time 0 LSB
          led_flash_message_array[7] = 1; // seq sel 1 = OFF
          led_flash_message_array[8] = offTimeBytes[0];
          led_flash_message_array[9] = offTimeBytes[1];
          console.log(led_flash_message_array);
          port.send(led_flash_message_array);

          statusDisplay.textContent = 'Device Output Updated to ' + selectedVoltage;
        } else {
          console.log('Voltages do not match:', actualVoltage, selectedVoltage);
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
