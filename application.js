(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
    const connectButton = document.querySelector("#connect");
    const statusDisplay = document.querySelector('#status');
    const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
    const voltageSelect = document.querySelector("#voltage_select");
    const programButton = document.querySelector("#program_button");
    const commandLine = document.querySelector("#command_line");
    const stressTest = document.querySelector("#stress_test");
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

    const usbMsgLen = Object.freeze ({
      SETV: 3,
      GETUUID: 2,
      LED: 4,
      GETV: 2
    })

    // ConfirmationBlink Array
    let confBlink = [
      { color: color.OFF, timeMS: 25 },
      { color: color.GREEN, timeMS: 25 },
      { color: color.OFF, timeMS: 25 },
      { color: color.GREEN, timeMS: 25 }
    ];
    
    // errorBlink Array
    let errorBlink = [
      { color: color.OFF, timeMS: 25 },
      { color: color.RED, timeMS: 25 },
      { color: color.OFF, timeMS: 25 },
      { color: color.RED, timeMS: 25 }
    ];

    // Helper function to convert milliseconds to MSB and LSB
    function msToBytes(ms) {
      const MSB = (ms >> 8) & 0xFF; // Most Significant Byte
      const LSB = ms & 0xFF; // Least Significant Byte
      return [MSB, LSB];
    }

    // LED Blink Helper Function
    function ledBlink (n_cycles, ledArr) {

      let flashArrayLength = (usbMsgLen.LED + (ledArr.length * 3)); //Calculating array length

      var led_flash_message_array = new Uint8Array(flashArrayLength); //setting array length
      led_flash_message_array.set([flashArrayLength, cmdCode.LED, n_cycles, ledArr.length], 0); //adding initial array values

      let i = usbMsgLen.LED;

      for(let k = 0; k < ledArr.length; k++, i++){
        led_flash_message_array[i] = ledArr[k].color; // send color code
        i++;
        let byteTime = msToBytes(ledArr[k].timeMS); //Convert MSB and LSB to byteTime array
        led_flash_message_array[i] = byteTime[0]; //MSB
        i++;
        led_flash_message_array[i] = byteTime[1]; //LSB
      }

      port.send(led_flash_message_array);
    }

    // Send Back Voltage Setting
    function getVoltage () {
      var get_voltage_setting_message_array = new Uint8Array(usbMsgLen.GETV);
      get_voltage_setting_message_array.set([usbMsgLen.GETV, cmdCode.GETV], 0);
      console.log(get_voltage_setting_message_array);
      port.send(get_voltage_setting_message_array);
      return actualVoltage;
    }

    //Set Voltage Function
    function setVoltage (selectedVoltage) {
      var array = new Uint8Array(usbMsgLen.SETV);
      array.set([usbMsgLen.SETV, cmdCode.SETV, selectedVoltage], 0);
      port.send(array);
    }

    
    function connect() {
      port.connect().then(() => {
        statusDisplay.textContent = '';
        connectButton.textContent = 'Disconnect';
        getVoltage();
        setTimeout(() => {
          statusDisplay.innerText = port.device_.productName + ' Connected:\nCurrently at ' + actualVoltage +'V';        
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
      }, 100); // Adjust the delay as necessary
    });

    document.getElementById('stress_test').addEventListener('click', async function() {
      let voltageSet = [5, 9, 12, 15, 20];
      let confCount = 0;
      let errorCount = 0;
  
      function delay(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
      }
  
      while (errorCount < 10) {
          for (let k = 0; k < voltageSet.length; k++) {
              // Setting new Voltage
              setVoltage(voltageSet[k]);
              console.log('Set voltage to:', voltageSet[k]);
  
              // Delay to allow for the voltage to be set
              await delay(50);
  
              // Getting programmed voltage
              await getVoltage();
              await delay(50);
  
              // Ensure actualVoltage is correctly set
              console.log('Actual voltage read:', actualVoltage);
  
              if (actualVoltage === voltageSet[k]) {
                  console.log('Voltages match:', actualVoltage, voltageSet[k]);
  
                  // Send confirmation blink
                  ledBlink(1, confBlink);
                  confCount++;
                  console.log('Confirmation count:', confCount);
                  console.log('Error Count:', errorCount);
              } else {
                  console.log('Voltages do not match:', actualVoltage, voltageSet[k]);
  
                  // Send error blink
                  ledBlink(1, errorBlink);
                  errorCount++;
                  console.log('Error count:', errorCount);
              }
  
              // Delay before the next iteration
              await delay(100);
          }

        // Retrieve existing results from localStorage or initialize empty array
        let existingResults = JSON.parse(localStorage.getItem('stressTestResults')) || [];

        // Add current results to existing results
        existingResults.push({ confCount, errorCount });

        console.log(existingResults);

        // Save updated results to localStorage
        localStorage.setItem('stressTestResults', JSON.stringify(existingResults));
      }
  
      
    });
  
    document.getElementById('download_results').addEventListener('click', function() {
      // Retrieve results from localStorage
      const resultsString = localStorage.getItem('stressTestResults');
      console.log('Retrieved results string:', resultsString);

      if (resultsString) {
          // Create a Blob from the results string
          const blob = new Blob([resultsString], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'stress_test_results.txt';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      } else {
          alert('No results to download.');
      }
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