(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', event => {
    const connectButton = document.querySelector("#connect");
    const statusDisplay = document.querySelector('#status');
    const controls = document.querySelector("#controls"); // Assuming this contains the voltage select and program button
    const voltageSelect = document.querySelector("#voltage_select");
    const programButton = document.querySelector("#program_button");
    const commandLine = document.querySelector("#command_line");

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
          if (data.getInt8() === 13) {
            currentReceiverLine = null;
            connectButton.textContent = 'Disconnect';
          } else {
            appendLines('receiver_lines', textDecoder.decode(data));
          }
        };
        port.onReceiveError = error => {
          console.error(error);
        };
      }).catch(error => {
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
      const selectedVoltage = voltageSelect.value;
      console.log(selectedVoltage);
      var array = new Uint8Array(1);
      array[0] = voltageSelect.value;
      console.log(array);
      port.send(array);
      statusDisplay.textContent = 'Device Output Updated to ' + selectedVoltage;
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
