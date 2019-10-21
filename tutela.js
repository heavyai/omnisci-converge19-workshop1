var globalGeocoder = null;

/*
 * Callback used for JSONP request for Google's Geocoder
 */
function mapApiLoaded() {
  globalGeocoder = new google.maps.Geocoder();
  geocoderObject.geocoder = globalGeocoder;
}

/*
 * Style and position your geocoder textbox here using standard jQuery
 * Also, set any event listeners you'd like.
 */
function initGeocoder(chart) {
  this.geocoder = new Geocoder(chart);
  this.geocoder.init(chart.map());
  this.geocoderInput = $(
    '<input class="geocoder-input" type="text" placeholder="Zoom to"></input>'
  ).appendTo($("#chart3-example"));
  this.geocoderInput.css({
    top: "5px",
    right: "5px",
    float: "right",
    position: "absolute"
  });

  // set a key-up event handler for the enter key
  this.geocoderInput.keyup(
    function(e) {
      if (e.keyCode == 13) {
        this.geocoder.geocode(this.geocoderInput.val());
      }
    }.bind(this)
  );
}

/*
 * The Geocoder wrapper for Google Maps' geocoder.
 * Has an ultra-small API that simply allows for geocoding a placeName.
 */
function Geocoder(chart) {
  this.geocoder = null;

  this.geocode = function(placeName) {
    this.geocoder.geocode({ address: placeName }, this._onResult);
  };

  this._onResult = function(data, status) {
    if (status != google.maps.GeocoderStatus.OK) {
      //throw "Geocoder error";
      return null;
    }
    var viewport = data[0].geometry.viewport;
    var sw = viewport.getSouthWest();
    var ne = viewport.getNorthEast();

    chart.map().fitBounds(
      [
        // api specifies lng/lat pairs
        [sw.lng(), sw.lat()],
        [ne.lng(), ne.lat()]
      ],
      { animate: false }
    ); // set animate to true if you want to pan-and-zoom to the location
  };

  this.init = function() {
    if (globalGeocoder == null) {
      // have to give global callback for when the loaded google js is executed
      geocoderObject = this;
      $.getScript(
        "https://maps.google.com/maps/api/js?sensor=false&async=2&callback=mapApiLoaded",
        function() {}
      );
    } else {
      this.geocoder = globalGeocoder;
    }
  };
}

function createCharts(crossFilter, con) {
  var colorScheme = ["#22A7F0", "#3ad6cd", "#d4e666"];

  var defaultColorRange = [
    "#115f9a",
    "#1984c5",
    "#22a7f0",
    "#48b5c4",
    "#76c68f",
    "#a6d75b",
    "#c9e52f",
    "#d0ee11",
    "#d0f400"
  ];

  var w =
    Math.max(document.documentElement.clientWidth, window.innerWidth || 0) - 50;
  var h =
    Math.max(document.documentElement.clientHeight, window.innerHeight || 0) -
    200;

  // You can get an array of columns with this command
  // var allColumns = crossFilter.getColumns();

  var rowChartDimension = crossFilter.dimension("Location_City");

  var rowChartGroup = rowChartDimension.group().reduceCount();

  var dcBarChart = dc
    .rowChart(".chart1-example")
    .height(h / 1.5)
    .width(w / 2)
    .elasticX(true)
    .cap(20)
    .othersGrouper(false)
    .ordinalColors(colorScheme)
    .measureLabelsOn(true)
    .dimension(rowChartDimension)
    .group(rowChartGroup)
    .autoScroll(true);


  /** Pie chart **/
  /*-----------------------PIE CHART-----------------------------------------*/


  /*----------------BACKEND RENDERED POINT MAP EXAMPLE-----------------------*/
  var xDim = crossFilter.dimension("Longitude_Center");
  var yDim = crossFilter.dimension("Latitude_Center");
  var parent = document.getElementById("chart3example");
  var mapboxToken =
    "pk.eyJ1IjoibWFwZCIsImEiOiJjaWV1a3NqanYwajVsbmdtMDZzc2pneDVpIn0.cJnk8c2AxdNiRNZWtx5A9g";

  /* Point Map Radius Size:
   * in order to calculate the radius size.  We use d3 scale and pass in a
   * domain and range.
   *
   * To learn more about d3 scales, please read this:
   * https://github.com/d3/d3-scale
   *
   * We then pass this scale into the r function within bubbleRasterChart
   */
  var sizeScale = d3.scale
    .linear()
    .domain([0, 5000])
    .range([1, 5]);

  var pointMapChart = dc
    .rasterChart(parent, true)
    .con(con)
    .height(h / 1.5)
    .width(w)
    .mapUpdateInterval(750)
    //.mapStyle('json/dark-v8.json')
    .mapboxToken(mapboxToken); // need a mapbox accessToken for loading the tiles

  var pointLayer = dc
    .rasterLayer("points")
    .crossfilter(crossFilter)
    .setState({
      transform: {
        sample: true,
        limit: 500000
      },
      mark: "point",
      encoding: {
        x: {
          type: "quantitative",
          field: "conv_4326_900913_x(Longitude_Center)"
        },
        y: {
          type: "quantitative",
          field: "conv_4326_900913_y(Latitude_Center)"
        },
        color: {
          type: "density",
          range: defaultColorRange
        },
        size: "auto"
      },
      config: {
        point: {
          shape: "triangle-up"
        }
      }
    })
    .xDim(xDim)
    .yDim(yDim)
    .popupColumns(["Device_SIMServiceProviderBrandName", "Average_Latency", "Connection_Category", "LocalYear"]);

  pointMapChart
    .pushLayer("points", pointLayer)
    .init()
    .then(chart => {
      // custom click handler with just event data (no network calls)
      pointMapChart.map().on("mouseup", logClick);
      function logClick(result) {
        console.log("clicked!", result);
      }
      // disable with pointMapChart.map().off('mouseup', logClick)

      // custom click handler with event and nearest row data
      pointMapChart.map().on("mouseup", logClickWithData);
      function logClickWithData(event) {
        pointMapChart.getClosestResult(event.point, function(result) {
          console.log(result && result.row_set[0]);
        });
      }

      // hover effect with popup
      var debouncedPopup = _.debounce(displayPopupWithData, 250);
      pointMapChart.map().on("mousewheel", pointMapChart.hidePopup);
      pointMapChart.map().on("mousemove", pointMapChart.hidePopup);
      pointMapChart.map().on("mousemove", debouncedPopup);
      function displayPopupWithData(event) {
        pointMapChart.getClosestResult(event.point, pointMapChart.displayPopup);
      }

      initGeocoder(pointMapChart);

      console.log("Pointmap initialized", chart);

      /* Find additional mapbox styles here:
       *
       * https://github.com/mapbox/mapbox-gl-styles/tree/master/styles
       */
    });

  dc.renderAllAsync();
}

function init() {
  new MapdCon()
    .protocol("https")
    .host("use2-api.mapd.cloud")
    .port("443")
    .dbName("mapd")
    .user("API Key Name from cloud instance SETTINGS")
    .password("API Key Secret from cloud instance SETTINGS")
    .connect(function(error, con) {
      crossfilter.crossfilter(con, "tutela_converge").then(cf => {
        createCharts(cf, con);
      });
    });
}

document.addEventListener("DOMContentLoaded", init, false);
