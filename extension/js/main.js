var fs = require('fs');
var https = require('https');
var http = require('http');

var _version = "1.0 14/05/2024";

const server = http.createServer();

//main app class, contains all data in state
var TradeLabelsServerApp = React.createClass({
    displayName: "TradeLabelsServerApp",

    getInitialState: function getInitialState() {

        
        var initialState = {
            activeTab:"Main",
            logText:"",
            status:"Stopped"
        };

        var prefsData = readPrefs();
        if (prefsData) {
            for (var prop in prefsData)
                if (prefsData[prop]) initialState[prop] = prefsData[prop];
        }

        return initialState;
    },

   
    setPanelCallback: function(event)
    {
        if (event.type === "com.adobe.csxs.events.flyoutMenuClicked") 
            this.updateState({activeTab:"Settings"});
    },
    
    componentWillMount: function componentWillMount() {
        var csInterface = new CSInterface();
        csInterface.setPanelFlyoutMenu('<Menu><MenuItem Id="menuItemSettings" Label="Settings" Enabled="true" Checked="false"/></Menu>', this.setPanelCallback);
        csInterface.addEventListener("com.adobe.csxs.events.flyoutMenuClicked", this.setPanelCallback);
       
    },
    
    componentDidMount: function componentDidMount() {
        var _this = this;
        server.on('request', (request, res) => {
            _this.updateLog(request.url);
            switch(request.url){
            case "/ping":
                _this.updateLog("ping request");
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end("InDesign is ready");
            break;
            
        case "/label":
            _this.updateLog("label request");
            let body = "";
            request.on('data',chunk=>{
                body+=chunk;
            })
            
            request.on('end',()=>{
                try{
                let parsedData = JSON.parse(body);
                
                processOrder(parsedData,_this.orderProcessed);
                
                parsedData.success = true;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(parsedData));
                }catch(e){
                    
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end("Couldn't parse data: "+e+": "+body);
                }
            })
            break;
        default: 
            //_this.updateLog("unknown request");
            }
        });
        
        
        this.startPressed();
    },
    
    orderProcessed: function(data) {
     this.updateLog("data received "+data);
      //send request with filepath and order data   
    },
    
    tabCallback: function tabCallback(tab) {
        var newState = this.state;
        newState.activeTab = tab;
        this.setState(newState);
    },
    
    updateState: function updateState(updateData) {
        var newState = this.state;
        for (var prop in updateData) {
            newState[prop] = updateData[prop];
        }

        this.setState(newState);
    },

    
    updateLog: function(logText)
    {
        var logText = logText+"\r"+this.state.logText;
        this.updateState({logText:logText});
    },
    


    
    startPressed:function()
    {
        
        this.updateState({status:"Started"});
        
        
        server.listen(3000);
        
    },
    
    
    stopPressed:function()
    {
        this.updateState({status:"Stopped"});
        
    },

    
    render: function render() {
        return React.createElement(
            "div",
            {
                className:"screen"
            },
            this.state.activeTab == "Settings" ? React.createElement(SettingsScreen, {
                appState: this.state,
                updateAppState: this.updateState
            }) : null,
            this.state.activeTab == "Main" ? React.createElement(MainScreen, {
                appState: this.state,
                updateAppState: this.updateState,
                startPressed:this.startPressed,
                stopPressed:this.stopPressed
            }) : null
        );
    }
});


var SettingsScreen = React.createClass({
    displayName: "SettingsScreen",
    
    
    handleChange: function (event, attribute) {
        var newState = this.state;
        newState[attribute] = event.target.value;
        this.setState(newState);
    },
    
    selectPressed: function(attribute)
    {
        var a = window.cep.fs.showOpenDialogEx(false, true, "Please choose folder");
        var folderPath = a.data[0];
        var myObj = {};
        myObj[attribute] = folderPath;
        this.props.updateAppState(myObj);
    },
    
    selectFilePressed: function(attribute)
    {
        var a = window.cep.fs.showOpenDialogEx(false, false, "Please choose file");
        var folderPath = a.data[0];
        var myObj = {};
        myObj[attribute] = folderPath;
        this.props.updateAppState(myObj);
    },
    
    
    savePressed: function()
    {
      //save prefs
     //update app state, tab to Browse
            
        
        savePrefs({
      
        });
        this.props.updateAppState({activeTab:"Main"});
    },

    render: function render() {
        var _this = this;
        
        return React.createElement(
            "div", {
                className: "settings"
            },
            
            React.createElement(
                "div", {
                    className: "loginFormRow save",
                    style: {
                        padding: 0
                    }
                },
                React.createElement(
                    "button", {
                        className: "waves-effect waves-light btn hand-cursor",
                        onClick:function()
                        {
                            _this.savePressed();
                        }
                    },
                    "Save"
                )
            )
        );
    }
});

//start screen
var MainScreen = React.createClass({
    displayName: "MainScreen",
    
    
    componentDidUpdate: function() {
      //this.refs.logArea.scrollTop = this.refs.logArea.scrollHeight;  
    },
    

    render: function render() {
        var _this = this;
     
        
        return React.createElement(
            "div", {
                className: "browse-view"
            },

            React.createElement(
                "button", {
                    className: "waves-effect waves-light btn hand-cursor",
                    onClick:this.props.startPressed
                },
                "Start"
            ),
            
            React.createElement(
                "button", {
                    className: "waves-effect waves-light btn hand-cursor",
                    onClick:this.props.stopPressed
                },
                "Stop"
            ),
            
            React.createElement(
                "p", {
                },
                "Status: "+this.props.appState.status
            ),
            
            React.createElement(
                "p", {
                },
                "Version: "+_version
            ),
            
            
            React.createElement(
                "textarea", {
                    ref:"logArea",
                    className:"logArea",
                    value:this.props.appState.logText
                }
            )
        );
    }
});


function evalScript(script, callback) {
    var csInterface = new CSInterface();
    csInterface.evalScript("$._ext_" + csInterface.hostEnvironment.appName + "." + script, callback);
}

function readPrefs() {
    var prefsObj = {};
    var csInterface = new CSInterface();
    var prefsFile = csInterface.getSystemPath(SystemPath.USER_DATA);
    prefsFile += "/LocalStore";

    var result = window.cep.fs.readdir(prefsFile);
    if (window.cep.fs.ERR_NOT_FOUND == result.err)
        window.cep.fs.makedir(prefsFile);

    var prefsPath = prefsFile + "/tradelabels_server.json";

    result = window.cep.fs.readFile(prefsPath);

    try {
        if (result.err == window.cep.fs.NO_ERROR && result.data) {
            prefsObj = JSON.parse(result.data);
        }
        


    } catch (e) {}

    return prefsObj;
}


function processOrder(orderData,callback)
{
    var extScript = 'processOrder("'+encodeURIComponent(JSON.stringify(orderData))+'")';
    evalScript(extScript,callback);
}

function savePrefs(prefsObject) {
    var csInterface = new CSInterface();
    var prefsFile = csInterface.getSystemPath(SystemPath.USER_DATA);
    prefsFile += "/LocalStore";

    var result = window.cep.fs.readdir(prefsFile);
    if (window.cep.fs.ERR_NOT_FOUND == result.err)
        window.cep.fs.makedir(prefsFile);

    var prefsPath = prefsFile + "/tradelabels_server.json";

    window.cep.fs.writeFile(prefsPath, JSON.stringify(prefsObject));
}



function myAlert(msg) {
    var extScript = "alert(\"" + msg.replace(/\"/g, "'") + "\");";
    var csInterface = new CSInterface();
    csInterface.evalScript(extScript);
}

try {
    ReactDOM.render(React.createElement(TradeLabelsServerApp), document.body);
} catch (e) {
    alert(e+":"+e.line)
}