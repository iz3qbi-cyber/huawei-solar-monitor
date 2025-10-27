// Huawei Solar Monitor - Main Application
// Web app for monitoring Huawei photovoltaic system

const express = require('express');
const ModbusRTU = require('modbus-serial');
const app = express();
const port = 3000;

// Modbus configuration for Huawei inverter
const modbusClient = new ModbusRTU();
const INVERTER_IP = process.env.INVERTER_IP || '192.168.1.100';
const MODBUS_PORT = 502;
const UNIT_ID = 1;

// Energy cost configuration (€/kWh)
const ENERGY_COST = {
  purchase: 0.25,  // Cost to buy from grid
  sale: 0.12       // Revenue from selling to grid
};

// Connect to Huawei inverter via Modbus TCP
async function connectToInverter() {
  try {
    await modbusClient.connectTCP(INVERTER_IP, { port: MODBUS_PORT });
    modbusClient.setID(UNIT_ID);
    console.log('Connected to Huawei inverter');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

// Fetch solar data from inverter
async function fetchSolarData() {
  try {
    // Read common Huawei solar registers
    const powerData = await modbusClient.readHoldingRegisters(32080, 2);
    const energyData = await modbusClient.readHoldingRegisters(32106, 2);
    const voltageData = await modbusClient.readHoldingRegisters(32066, 1);
    
    return {
      activePower: powerData.data[0] * 100, // W
      dailyEnergy: energyData.data[0] * 100, // Wh
      voltage: voltageData.data[0] * 10, // V
      timestamp: new Date()
    };
  } catch (err) {
    console.error('Error fetching data:', err);
    return null;
  }
}

// Calculate energy costs and savings
function calculateCosts(data) {
  const dailyEnergyKWh = data.dailyEnergy / 1000;
  const savings = dailyEnergyKWh * ENERGY_COST.purchase;
  const revenue = dailyEnergyKWh * ENERGY_COST.sale;
  
  return {
    dailySavings: savings.toFixed(2),
    potentialRevenue: revenue.toFixed(2),
    energyProduced: dailyEnergyKWh.toFixed(2)
  };
}

// Serve static files
app.use(express.static('public'));

// API endpoint to get current solar data
app.get('/api/solar-data', async (req, res) => {
  const data = await fetchSolarData();
  if (data) {
    const costs = calculateCosts(data);
    res.json({ ...data, costs });
  } else {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Simple HTML interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Huawei Solar Monitor</title>
      <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .dashboard { max-width: 800px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { font-size: 24px; font-weight: bold; color: #2196F3; }
        .label { color: #666; margin-bottom: 5px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h1>🌞 Huawei Solar Monitor</h1>
        <div class="card">
          <div class="label">Active Power</div>
          <div class="metric" id="power">Loading...</div>
        </div>
        <div class="card">
          <div class="label">Daily Energy Production</div>
          <div class="metric" id="energy">Loading...</div>
        </div>
        <div class="card">
          <div class="label">Daily Savings</div>
          <div class="metric" id="savings">Loading...</div>
        </div>
        <div class="card">
          <div class="label">Voltage</div>
          <div class="metric" id="voltage">Loading...</div>
        </div>
      </div>
      <script>
        async function updateData() {
          try {
            const response = await fetch('/api/solar-data');
            const data = await response.json();
            document.getElementById('power').textContent = data.activePower + ' W';
            document.getElementById('energy').textContent = data.costs.energyProduced + ' kWh';
            document.getElementById('savings').textContent = '€ ' + data.costs.dailySavings;
            document.getElementById('voltage').textContent = data.voltage + ' V';
          } catch (err) {
            console.error('Error:', err);
          }
        }
        updateData();
        setInterval(updateData, 5000); // Update every 5 seconds
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`Huawei Solar Monitor running at http://localhost:${port}`);
  connectToInverter();
});
