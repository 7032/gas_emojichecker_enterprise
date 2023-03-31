//========================================================================================
//  Written by Naomitsu Tsugiiwa/7032 https://github.com/7032
//  This source is under MIT license. Please read LICENSE.
//  (C)2023 Naomitsu Tsugiiwa all rights reserved.
//========================================================================================
//----------------------------------------------------------------------------------------
//  local functions
//----------------------------------------------------------------------------------------
//  send a message to Slack as Incoming Webhook
//    propName : label of Script Property that stored URL for the Incoming Webhook.
//    message  : message to be sent to the slack channel.
function  _SendMessageToSlack(propName,message) {
  const propService = PropertiesService.getScriptProperties();
  const url  = propService.getProperty(propName);
  try {
    var response  = UrlFetchApp.fetch(
                      //  URL stored in the property
                      url,
                      //  Options set to header and payload
                      {
                        "method" :            "POST",
                        "headers":            { "Content-Type" : "application/json", },
                        "payload":            JSON.stringify({ "text" : message }),
                        "muteHttpExceptions": true
                      }
                    );
  }
  catch (e) {
    console.log("[Slack:WebHook error]"+JSON.stringify(e)+"\nURL:"+url);
  }
}

//  get current all emoji
//    propName : label of Script Property that stored the API token to access Admin API.
function  _peekAllCurrentEmoji(propName) {
  var allList = {};
  var pageToken = "";
  var fLoop     = true;
  const apiToken  = PropertiesService.getScriptProperties().getProperty(propName);
  for(;fLoop;) {
    var url = "https://slack.com/api/admin.emoji.list?limit=1000";
    if (pageToken.length > 0) {
      url +=  "&cursor="
          + pageToken;
    }
    const response  = UrlFetchApp.fetch(
                        url,
                        { "method" : "GET",
                          "headers" : {
                            "Authorization" : "Bearer " + apiToken
                          },
                          "muteHttpExceptions" : true
                        }
                      );
    const resultTxt = response.getContentText();
    const resultJson= JSON.parse(resultTxt);
    pageToken = resultJson['response_metadata']['next_cursor'];
    fLoop = false;
    if (pageToken.length > 0) {
      fLoop = true;
    }
    Object.assign(allList,resultJson['emoji']);
  }
  return  allList;
}

//  get the Slack account who did register the emoji.
//    propName : label of Script Property that stored the API token to access Admin API.
//    emoji    : emoji name
function  _getOriginalRegistererOfEmoji(propName,emoji) {
  const allList = _peekAllCurrentEmoji(propName);
  const result  = allList[emoji];
  if (result != null) {
    if (result['uploaded_by']) {
      return  result['uploaded_by'];
    }
  }
}

//========================================================================================
//  Entry when POST was sent
//========================================================================================
function  doPost(e) {
  const rowData = e.postData.getDataAsString();
  const jsonData = JSON.parse(rowData);
  //  check event
  if (jsonData["event"]) {
    if (jsonData["event"]["type"]) {
      switch(jsonData.event.type) {
      //  EMOJI
      case  "emoji_changed": {
        //  Add EMOJI
        const emojiName = jsonData.event.name;
        const emojiVal  = jsonData.event.value;
        const emojiAli  = "alias:";
        var   strMessage= "*[New EMOJI]* :"+emojiName+": is added as *`:"+emojiName+":`*";
        //  「この絵文字は誰が追加したか」の情報を付加する
        const updateBy  = _getOriginalRegistererOfEmoji("api-token",emojiName);
        if (updateBy != null) {
          strMessage  +=  " by <@"
                      + updateBy
                      +   ">"
        }
        strMessage  +=  "!!!\n";
        //  この絵文字は新規追加かエイリアスかによって表示を分ける
        if (emojiVal.slice(0,emojiAli.length) == emojiAli) {
          const emojiOrginal  = emojiVal.slice(emojiAli.length);
          strMessage  +=  "This is just an *alias* of *`:"+emojiOrginal+":`* :"+emojiOrginal+":";
        } else {
          strMessage  +=  "Original picture is "+emojiVal;
        }
        _SendMessageToSlack("Webhook-EMOJI",strMessage);
        }
        break;
      }
    }
  }

  //  return a response as HTML to confirm the challenge
  if (jsonData['challenge']) {
    const output = ContentService.createTextOutput(jsonData['challenge']);
    output.setMimeType(ContentService.MimeType.TEXT);
    return output;
  }
  const output = ContentService.createTextOutput("ok");
  output.setMimeType(ContentService.MimeType.TEXT);
  return output;
}
