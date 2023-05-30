// Build field names table
function buildTable(o, par) {
  if (o !== null && typeof o == "object") {
    Object.keys(o).forEach(function(key) {
      // Add an entry
      var r = document.createElement("tr");
      var e = document.createElement("td");
      r.appendChild(e);
      if (typeof o[key] == "boolean") {
        e.innerText = key;
        e.id = key;
        e.classList.add("fcell");
      } else {
        // Add a subtable
        var t = document.createElement("table");
        e.appendChild(t);

        // Add subtable header
        var ir = document.createElement("tr");
        var ie = document.createElement("th");
        ie.innerText = key;
        ir.appendChild(ie);
        t.appendChild(ir);
        
        buildTable(o[key], t);
      }
      par.appendChild(r);
    })
  }
}

var t = document.createElement("table");
t.id = "tfields";
buildTable(fieldNames, t);
document.getElementById("centercol").appendChild(t);

// Restore any previous script
var txt = document.getElementById("tealscript");
txt.value = localStorage.getItem("teal");

var graphWrapper = document.getElementById("graphwrap");

/*
 * <Node>
 */

function Node(name, code, offset) {
  this.name = name;
  this.code = code;
  this.offset = offset;
  this.children = [];
}

Node.prototype.addChild = function(node) {
  this.children.push(node);
}

function Edge(to, condition, callsub) {
  this.to = to;
  this.condition = condition;
  this.callsub = callsub;
}

/*
 * </Node>
 */

/*
 * <Graph>
 */

function Graph(code) {
  // Map node name -> node
  this.nodes = {};

  // Map node name -> [Edge]
  this.edges = {};

  // Process branches and labels
  this.splitBranchesAndLabels(escapeCode(code));
}

function escapeCode(code) {
  return code.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\|/g, "\\|");
}

Graph.prototype.splitBranchesAndLabels = function(code) {
  var block = [];
  var lastLabel = "entry";
  var lines = code.split("\n");
  var wasReturn = false;
  var wasGoto = null;
  var deadCodeCounter = 0;

  var i = 0;
  for (i = 0; i < lines.length; i++) {
    // Strip comments
    var cs = lines[i].indexOf("//");
    var line = lines[i].substring(0, cs == -1 ? undefined : cs);

    // Strip pragma
    var pr = line.indexOf("#");
    if (pr != -1) {
      line = line.substring(0, pr);
    }

    // Strip trailing whitespace
    line = line.trim();
    if (line === "") {
      continue;
    }
    block.push(line);

    // Match branches and labels
    var branchMatch = line.match(/^b(?:n?z)\s+(.*)/);
    var gotoMatch = line.match(/^(?:b)\s+(.*)/);
    var labelMatch = line.match(/(.*):/);
    var returnMatch = line.match(/^return.*/);
    var callsubMatch = line.match(/^callsub\s+(.*)/);
    var retsubMatch = line.match(/^retsub.*/);
    if ((returnMatch || retsubMatch) && !wasReturn) {
      wasReturn = true;
      continue;
    }
    if (branchMatch || labelMatch || callsubMatch || gotoMatch) {
      // remove last line if we seen return and this line is label - dead end
      if (labelMatch && wasReturn) {
        block.pop();
      }

      if (labelMatch && wasGoto) {
        // if there was an unconditional branch and current line is label
        // then reset the label
        var newLabel = labelMatch[1];
        lastLabel = labelMatch[1];
        // check of there is some dead code after the unconditional branch
        // if so then create a appropriate block
        var deadCodeLines = [];
        while (!block[0].match(/(.*):/)) {
          deadCodeLines.push(block[0])
          block.shift() // consume lines between unconditional brach and the label
        }
        if (deadCodeLines && deadCodeLines.length > 0) {
          var label = "dead_code_" + deadCodeCounter;
          if (!this.edges[wasGoto]) {
            this.edges[wasGoto] = [];
          }
          this.edges[wasGoto].push(new Edge(label, null, false));
          var node = new Node(label, deadCodeLines.join("\n"), i);
          this.nodes[label] = node;
          deadCodeCounter++;
        }
        block.shift()  // consume label line
        wasGoto = null;
        continue;
      }

      if (branchMatch) {
        // Removes branch instruction from the block
        block.pop();
      }

      // Create a node named after the most recent label
      var node = new Node(lastLabel, block.join("\n"), i);
      this.nodes[lastLabel] = node;
      block = [];

      // If this was a label, then name the next node
      // after the label. Otherwise, name it after the
      // branch
      if (labelMatch) {
        var newLabel = labelMatch[1];

        // Add an edge from the old label to the new label
        if (!this.edges[lastLabel]) {
          this.edges[lastLabel] = [];
        }
        // there was return on previous line then do not create a new edge
        if (!wasReturn) {
          this.edges[lastLabel].push(new Edge(newLabel, null, false));
        }

        // Update lastLabel, which names the next block of code
        lastLabel = newLabel;
      } else if (gotoMatch) {
        var newLabel = gotoMatch[1]
        if (!this.edges[lastLabel]) {
          this.edges[lastLabel] = [];
        }
        // Add an edge from the old to the new destination
        this.edges[lastLabel].push(new Edge(newLabel, null, false));
        wasGoto = lastLabel;
        lastLabel = newLabel;
      } else if (branchMatch || callsubMatch) {
        var newLabel = "fallthru_" + i + "_" + line.replace(/\s/g, "_");

        var edge = branchMatch ? branchMatch[1] : callsubMatch[1]
        // As a branch, we will point to two nodes:
        // the first is the target label of the branch (bnz taken)
        // the second is the subsequent code (bnz not taken)
        if (!this.edges[lastLabel]) {
          this.edges[lastLabel] = [];
        }
        const isCallsub = !!callsubMatch;
        let targetCondition = null;
        let fallthroughCondition = null;
        if (branchMatch) {
          if (branchMatch[0].startsWith("bz")) {
            targetCondition = false;
          } else {
            targetCondition = true;
          }
          fallthroughCondition = !targetCondition;
        }
        this.edges[lastLabel].push(new Edge(edge, targetCondition, isCallsub));
        this.edges[lastLabel].push(new Edge(newLabel, fallthroughCondition, false));

        // Update lastLabel, which names the next block of code
        lastLabel = newLabel;
      }
    }
    wasReturn = false;
  }

  var node = new Node(lastLabel, block.join("\n"), i);
  this.nodes[lastLabel] = node;
}

Graph.prototype.generateNoml = function() {
  var lines = ["#font: courier"];
  var self = this;

  // Add code sections
  Object.keys(self.nodes).forEach(function(key) {
    lines.push("[" + key + "|");
    lines.push(self.nodes[key].code);
    lines.push("]");
  });

  Object.keys(self.edges).forEach(function(key) {
    var edges = self.edges[key];
    for (var i = 0; i < edges.length; i++) {
      var edge = ""
      edge += "[" + key + "]->[" + edges[i].to + "]";
      lines.push(edge);
    }
  });

  return lines.join("\n")
}

Graph.prototype.generateDot = function() {
  var lines = [
    "digraph {",
    "node [shape=box]",
  ];
  var self = this;

  // Add code sections
  Object.keys(self.nodes).forEach(function(key) {
    const node = self.nodes[key];
    let code = node.code.replaceAll("\n", "\\n");
    if (!node.name.startsWith("fallthru_")) {
      code = node.name + ":\\n" + code;
    }
    lines.push(key + " [label=\"" + code + "\"]");
  });

  Object.keys(self.edges).forEach(function(key) {
    var edges = self.edges[key];
    for (var i = 0; i < edges.length; i++) {
      var edge = ""
      edge += key + " -> " + edges[i].to;
      if (edges[i].condition != null) {
        edge += " [label=\"" + edges[i].condition + "\"]";
      }
      if (edges[i].callsub) {
        edge += " [dir=both]"
      }
      lines.push(edge);
    }
  });

  lines.push("}");
  return lines.join("\n")
}

function initOrAppend(map, key, value) {
  if (!map[key]) {
    map[key] = {};
  }
  map[key][value] = true;
}

function getCheckedFields(code) {
  var lines = code.split("\n");
  var checked = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var tmatch = line.match(/^txn\s+(.*)/);
    if (tmatch) {
      initOrAppend(checked, tmatch[1], 0);
      continue;
    }

    var gtmatch = line.match(/^gtxn\s+(\d+)\s+(.*)/);
    if (gtmatch) {
      initOrAppend(checked, gtmatch[2], parseInt(gtmatch[1]) + 1);
      continue;
    }

    var globmatch = line.match(/^global\s+(.*)/);
    if (globmatch) {
      // -1 indicates that this is not a check associated with a particular txn
      initOrAppend(checked, globmatch[1], -1);
      continue;
    }

  }

  return checked;
}

var bgColors = [
  "#000000",
  "#575757",
  "#AD2323",
  "#2A4BD7",
  "#1D6914",
  "#814A19",
  "#8126C0",
  "#A0A0A0",
  "#81C57A",
  "#9DAFFF",
  "#29D0D0",
  "#FF9233",
  "#FFEE33",
  "#E9DEBB",
  "#FFCDF3",
  "#FFFFFF",
  "#9DAFFF"
];

var txtColors = [
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#000000",
  "#000000",
  "#000000",
  "#000000",
  "#FFFFFF"
];

Graph.prototype.updateCheckedFields = function() {
  var boxes = document.getElementsByClassName("highlighted");

  // Mark checked fields for each section
  var checked = {};
  for (var i = 0; i < boxes.length; i++) {
    var node = this.nodes[boxes[i].id];
    var c = getCheckedFields(node.code);
    Object.keys(c).forEach(function(key) {
      // Merge in checked fields
      checked[key] = {...checked[key], ...c[key]};
    });
  }

  // Reset checked highlight
  var cells = document.getElementsByClassName("fcell");
  for (var i = 0; i < cells.length; i++) {
    cells[i].classList.remove("checked");
  }

  // Reset selected indicators
  var inds = document.getElementsByClassName("check-indicator");
  for (var i = inds.length - 1; i >= 0; i--) {
    inds[i].remove();
  }

  // Set checked highlight
  Object.keys(checked).forEach(function(key) {
    var cell = document.getElementById(key);
    if (cell) {
      cell.classList.add("checked");

      // Mark which txns we checked the field for
      Object.keys(checked[key]).sort((x, y)=>(parseInt(x) - parseInt(y))).forEach(function(txidx) {
        var txt;
        if (txidx == -1) {
          return;
        } else if (txidx == 0) {
          txt = "★";
        } else {
          txt = String(txidx - 1);
        }
        var elt = document.createElement("span");
        elt.innerText = "[" + txt + "]";
        elt.classList.add("check-indicator");
        var colorIdx = txidx == "this" ? 0 : txidx;
        elt.style.backgroundColor = bgColors[colorIdx % bgColors.length];
        elt.style.color = txtColors[colorIdx % txtColors.length];
        cell.appendChild(elt);
      });
    }
  })
}

Graph.prototype.handleClick = function(e) {
  e.target.classList.toggle("highlighted");
  this.updateCheckedFields();
}

Graph.prototype.handleClicks = function() {
  var boxes = document.getElementsByClassName("node");
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].addEventListener("click", this.handleClick.bind(this));
  }
}

/*
 * </Graph>
 */

function draw() {
  var g = new Graph(txt.value);
  console.log(g.generateDot());
  var svg = nomnoml.renderSvg(g.generateNoml());
  graphWrapper.innerHTML = svg;

  // Entry always starts off highlighted
  document.getElementById("entry").classList.toggle("highlighted");
  g.updateCheckedFields();

  g.handleClicks();
}

txt.addEventListener('input', function() {
  localStorage.setItem('teal', txt.value);
  draw();
});

draw();
