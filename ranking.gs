//========================================================================================
//  Written by Naomitsu Tsugiiwa/7032 https://github.com/7032
//  This source is under MIT license. Please read LICENSE.
//  (C)2023 Naomitsu Tsugiiwa all rights reserved.
//========================================================================================
class SlackEmojiChecker {
//  properties/constructor/destructor
constructor() {
  this.allEmoji = {};
}
  
//  send a message to Slack as Incoming Webhook
//    propName : label of Script Property that stored URL for the Incoming Webhook.
//    message  : message to be sent to the slack channel.
static  sendMessageToSlack(propName,message) {
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
peekAllCurrentEmoji(propName) {
  var this.allEmoji = {};
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
    Object.assign(this.allEmoji,resultJson['emoji']);
  }
  return  this.allEmoji;
}

//  get the Slack account who did register the emoji.
//    propName : label of Script Property that stored the API token to access Admin API.
//    emoji    : emoji name
getOriginalRegistererOfEmoji(propName,emoji) {
  if (this.allEmoji.length == 0) {
    this.peekAllCurrentEmoji(propName);
  }
  const result  = this.allEmoji[emoji];
  if (result != null) {
    if (result['uploaded_by']) {
      return  result['uploaded_by'];
    }
  }
  return  null;
}

//  get all emoji during the range
//    range : time range to collect emojis' from when.
getEmojiRegistererDuringRange(range) {
  if (this.allEmoji.length == 0) {
    this.peekAllCurrentEmoji("api-token");
  }
  var allCount = {};
  for(var key in this.allEmoji) {
    const val = this.allEmoji[key];
    const user = val['uploaded_by'];
    const item  = {
      "name": key,
      "url":  val['url'],
      "date_created": val['date_created']
    }
    var fAdd  = ((range == null) ? true : false);
    if (range) {
      if (item.date_created >= range) {
        fAdd  = true;
      }
    }
    if (fAdd) {
      const keys  = Object.keys(allCount);
      if (keys.indexOf(user) == -1) {
        allCount[user]  = [ item ];
      } else {
        allCount[user].push(item);
      }
    }
  }
  //  collect per each owner
  var ranking = [];
  for(var i in allCount) {
    const item  = allCount[i];
    ranking.push(
      { "owner":    i,
        "contents": item
      }
    )
  }
  //  sort by the number of registered items.
  ranking.sort(
    function(a,b) {
      const numA  = a['contents'].length;
      const numB  = b['contents'].length;
      return  numB  - numA;
    }
  );

  return  {
    "allItems": allCount,
    "ownedBy":  ranking
  };
}
  
//  end of class
};

//
//  Global function : to show monthly emoji registerer ranking.
//
function  _showMonthlyRanking() {
  const oSlack  = new SlackEmojiChecker();
  const beginDate = new Date();
  const lastMonth = beginDate.setMonth(beginDate.getMonth() - 1); //  from 1 month ago.
  const result  = oSlack.getEmojiRegistererRanking(lastMonth/1000);  //  msec to sec.
  const ranking = result.ownedBy;
  var strMsg  = "*This month EMOJI register ranking!*\n";
  
  for(var i in ranking) {
    //  show the registerer
    strMsg  +=  (Number(i)+1).toString()
            + " : <@"
            + ranking[i].owner
            + "> *("
            + ranking[i].contents.length
            + ")* = ";
    //  arrange all items those the ranker registered.
    for(var j in ranking[i].contents) {
      const item  = ranking[i].contents[j];
      strMsg  +=  ":"
              + item.name
              + ": ";
    }
    strMsg  +=  "\n";
  }
  SlackEmojiChecker.sendMessageToSlack(
    "incoming-webhook-url",
    strMsg
  )
}
