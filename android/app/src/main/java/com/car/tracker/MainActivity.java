package com.car.tracker;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Add custom plugins BEFORE calling super.onCreate()
        initialPlugins = new ArrayList<>();
        initialPlugins.add(ClassicBluetoothPlugin.class);
        initialPlugins.add(BackgroundTracker.class);
        
        super.onCreate(savedInstanceState);
    }
}
