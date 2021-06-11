function Graph () {
  // Map from year to maps from publications to citations.
  this.data = new Array();
}

Graph.prototype.getYear = function (str) {
  return parseInt(str.match(/[0-9][0-9][0-9][0-9]/));
};

Graph.prototype.addPublicationUnlessExists = function (publication) {
  var year = this.getYear(publication);
  if (!(year in this.data)) {
    this.data[year] = new Array();
  }
  if (!(publication in this.data[year])) {
    this.data[year][publication] = { 
        cites:{}, provides:{}, original:{}, toDraw:{}, importance:{}, citedBy:{}};
  }
};

Graph.prototype.addCitation = function (citer, citee) {
  this.addPublicationUnlessExists(citer);
  this.addPublicationUnlessExists(citee);
  // Mimicking a set using a dictionary.
  this.data[this.getYear(citer)][citer].cites[citee] = true;
};

// Data is a map from a string id to an array of string ids.
Graph.prototype.parse = function (data) {
  var self = this;
  $.each(data, function (key, value) {
    $.each(value, function(index, item) {
      self.addCitation(key.toLowerCase(), item.toLowerCase());
    });
  });
};

Graph.prototype.getPosition = function (publication) {
  var copy = this.data[this.getYear(publication)][publication];
  return {x: copy.x, y: copy.y};
}

Graph.prototype.assignPositions = function () {
  var self = this;
  var years = Object.keys(this.data);
  var y = 50;
  for (var i = years.length; i--;) {
    var x = 200;
    Object.keys(this.data[years[i]]).forEach(function (publication) {
      self.data[years[i]][publication].x = x + (Math.random() * 150) - 75;
      self.data[years[i]][publication].y = y;
      x += 150;
    });
    y+=50;
  }
}

Graph.prototype.assignPositions2 = function () {
  var self = this;
  // Y: Years descending
  var years = Object.keys(this.data);
  var y = 50;
  for (var i = years.length; i--;) {
    Object.keys(this.data[years[i]]).forEach(function (publication) {
      self.data[years[i]][publication].y = y;
    });
    y+=50;
  }
  
  // X: From earliest to latest: If leaf, increasing, otherwise avg. x of cites.
  var x = 200;
  var maxx = 1600;
  Object.keys(this.data).forEach(function (year) {
    var occupiedX = [];
    var alternatives = [];
    var mindist = 30;
    
    function addOccupied(x) {
      occupiedX.push(x);
      altenatives = alternatives.filter(function (alt) {
        return Math.abs(x - alt) >= mindist
      });
      
      var own_alts = [x + mindist, x - mindist];
      alternatives = alternatives.concat(own_alts.filter(function (alt) {
        for (var i = 0; i < occupiedX.length; i++) {
          if (Math.abs(occupiedX[i] - alt) < mindist) {
            return false;
          }
        }
        return true;
      }));
    }
    
    function assignClosestPossible(x) {
      var allright = true;
      for (var i = 0; i < occupiedX.length; i++) {
        if (Math.abs(occupiedX[i] - x) < mindist) {
          allright = false;
        }
      }
      if (allright) {
        addOccupied(x);
        return x;
      }
      
      var closest = 10000;
      var best = x;
      for (var i = 0; i < alternatives.length; i++) {
        if (Math.abs(alternatives[i] - x) < closest) {
          closest = Math.abs(alternatives[i] - x);
          best = alternatives[i];
        }
      }
      
      addOccupied(best);
      return best;
    }
    
    Object.keys(self.data[year]).forEach( function (publication) {
      var cites = Object.keys(self.data[year][publication].cites);
      // Remove cites from same year.
      cites = cites.filter(function (cite) {
        return self.getYear(cite) < year;
      });
      if (cites.length == 0) {
        self.data[year][publication].x = x;
        addOccupied(x);
        x += 50;
        if (x > maxx) {
          x = 200;
        }
      } else {
        var avg = 0.0;
        cites.forEach(function (cite) {
          avg += self.data[self.getYear(cite)][cite].x
        });
        avg /= cites.length;
        self.data[year][publication].x = assignClosestPossible(avg);
      }
    });
  });
}

Graph.prototype.redraw = function (canvas) {
  canvas.removeLayers();
  
  var self = this;
  
  // Draw edges (below vertices).
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach( function (publication) {
      Object.keys(self.data[year][publication].toDraw).forEach( 
          function (citation) {
        var citerposition = self.getPosition(publication);
        var citeeposition = self.getPosition(citation);
        canvas.drawLine({
          layer: true,
          strokeStyle: 'white',
          strokeWidth: Math.log(3 * self.data[year][publication].importance[citation]),
          x1: citerposition.x, y1: citerposition.y,
          x2: citeeposition.x, y2: citeeposition.y
        });
      });
    });
  });
  
  // Draw vertices.
  var years = Object.keys(this.data);
  var y = 50;
  for (var i = years.length; i--;) {
    $('canvas').drawText({
      layer:true,
      fillStyle: 'white',
      x: 50, y: y,
      fontSize: 20,
      fontFamily: 'Verdana, sans-serif',
      text: years[i]
    });
    Object.keys(this.data[years[i]]).forEach(function (publication) {
      canvas.drawArc({
        layer:true,
        name:publication,
        fillStyle: 'white',
        x: self.data[years[i]][publication].x, 
        y: self.data[years[i]][publication].y,
        radius: 3 + Object.keys(self.data[years[i]][publication].citedBy).length,
        mouseover: function(layer) {
          // Print paper name.
          $("#paper").html(publication);
          // Highlight references.
          Object.keys(self.data[self.getYear(publication)][publication].cites).forEach(function (reference) {
            canvas.setLayer(reference, { fillStyle: 'red' });
          });
          // Highlight citations.
          Object.keys(self.data[self.getYear(publication)][publication].citedBy).forEach(function (citation) {
            canvas.setLayer(citation, { fillStyle: 'blue' });
          });
          canvas.drawLayers();
        },
        mouseout: function(layer) {
          Object.keys(self.data[self.getYear(publication)][publication].cites).forEach(function (reference) {
            canvas.setLayer(reference, { fillStyle: 'white' });
          });
          Object.keys(self.data[self.getYear(publication)][publication].citedBy).forEach(function (citation) {
            canvas.setLayer(citation, { fillStyle: 'white' });
          });
          canvas.drawLayers();
        }
      });
    });
    y+=50;
  }
}

Graph.prototype.draw = function (canvas) {
  this.assignPositions2();
  var self = this;
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach( function (publication) {
      self.data[year][publication].toDraw = self.data[year][publication].cites;
    });
  });
  this.redraw(canvas);
}

Graph.prototype.calculateProvisions = function () {
  var self = this;
  // Order matters - we have to start from the bottom!
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach(function (publication) {
      Object.keys(self.data[year][publication].cites).forEach(function (cite) {
        self.data[year][publication].provides[cite] = true;
        Object.keys(self.data[self.getYear(cite)][cite].provides).forEach(
            function (provision) {
          self.data[year][publication].provides[provision] = true;
        });
      });
    });
  });
}

Graph.prototype.calculateOriginals = function () {
  var self = this;
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach(function (publication) {
      Object.keys(self.data[year][publication].cites).forEach(function (candidate_cite) {
        var is_original = true;
        Object.keys(self.data[year][publication].cites).forEach(function (other_cite) {
          if (candidate_cite in 
              self.data[self.getYear(other_cite)][other_cite].provides) {
            is_original = false;
          }
        });
        if (is_original) {
          self.data[year][publication].original[candidate_cite] = true;
          self.data[year][publication].importance[candidate_cite] = 1.0;
        }
      });
    });
  });
}

Graph.prototype.importanceBfs = function (node, points, goal) {
  var self = this;
  var middlemen = [];
  Object.keys(this.data[this.getYear(node)][node].original).forEach(function (middleman_candidate) {
    if (Object.keys(self.data[self.getYear(middleman_candidate)][middleman_candidate].provides).indexOf(goal) > -1) {
      middlemen.push(middleman_candidate)
    }
  });
  if (middlemen.length == 0) {
    return;
  }
  var new_points = points / middlemen.length;
  middlemen.forEach(function (middleman) {
    self.data[self.getYear(node)][node].importance[middleman] += new_points;
    self.importanceBfs(middleman, new_points, goal);
  });
}

Graph.prototype.calculateImportance = function () {
  var self = this;
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach(function (publication) {
      Object.keys(self.data[year][publication].cites).forEach(function (cite) {
        self.importanceBfs(publication, 1.0, cite);
      });
    });
  });
}

Graph.prototype.calculateCitedBy = function () {
  var self = this;
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach(function (publication) {
      Object.keys(self.data[year][publication].cites).forEach(function (cite) {
        self.data[self.getYear(cite)][cite].citedBy[publication] = true;
      });
    });
  });
}

Graph.prototype.consolidate = function (canvas) {
  var self = this;
  this.calculateProvisions();
  this.calculateOriginals();
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach( function (publication) {
      self.data[year][publication].toDraw = self.data[year][publication].original;
    });
  });
  this.calculateImportance();
  this.calculateCitedBy();
  this.redraw(canvas);
}

Graph.prototype.prune = function (canvas) {
  var self = this;
  // Remove publications with 0 references and only one citation.
  Object.keys(this.data).forEach(function (year) {
    Object.keys(self.data[year]).forEach( function (publication) {
      if (Object.keys(self.data[year][publication].cites).length == 0 &&
          Object.keys(self.data[year][publication].citedBy).length == 1) {
        var citer = Object.keys(self.data[year][publication].citedBy)[0];
        delete self.data[self.getYear(citer)][citer].cites[publication];
        delete self.data[self.getYear(citer)][citer].original[publication];
        delete self.data[year][publication];
      }
    });
  });
  
  this.redraw(canvas);
}
