require('dotenv').config();
const mongoose = require('mongoose');

async function testConnections() {
    console.log('🧪 Testing MongoDB connections...\n');
    
    const connections = [
        {
            name: 'MongoDB Atlas (Primary)',
            uri: process.env.MONGODB_URI
        },
        {
            name: 'MongoDB Atlas (Fallback)',
            uri: process.env.MONGODB_URI_FALLBACK
        },
        {
            name: 'Local MongoDB',
            uri: process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/edit'
        }
    ];
    
    for (const conn of connections) {
        if (!conn.uri) {
            console.log(`❌ ${conn.name}: No URI provided`);
            continue;
        }
        
        try {
            console.log(`🔄 Testing ${conn.name}...`);
            await mongoose.connect(conn.uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });
            
            console.log(`✅ ${conn.name}: Connected successfully!`);
            console.log(`   Database: ${mongoose.connection.name}`);
            console.log(`   Host: ${mongoose.connection.host}\n`);
            
            await mongoose.disconnect();
            return; // Use the first successful connection
        } catch (error) {
            console.log(`❌ ${conn.name}: ${error.message}\n`);
        }
    }
    
    console.log('⚠️ All connections failed. Will run in memory mode.');
}

testConnections().then(() => {
    console.log('🏁 Connection test completed');
    process.exit(0);
});