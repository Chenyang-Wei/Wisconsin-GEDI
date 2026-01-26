var centroid_Geom = ee.Geometry.Point([
  -88.5156479853493, 45.551684609647054
]);

// Create a buffer around the randomly picked point.
var bufferRadius_Num = 3e4;

var buffer_Geom = centroid_Geom.buffer(bufferRadius_Num);


// Determine a ROI based on the created buffer.
var AOI_Geom = buffer_Geom.bounds();

Map.setOptions("HYBRID");
Map.centerObject(centroid_Geom, 10);
Map.addLayer(AOI_Geom, {color: "FFFFFF"}, "ROI");

// Target spatial scale.
var targetScale_Num = 30;

// Prepare the Daymet V4 dataset.
var daymet_IC = ee.ImageCollection("NASA/ORNL/DAYMET_V4");

// Define a target projection.
var targetProjection_Prj = ee.Image(daymet_IC.first())
  .projection()
  .atScale(targetScale_Num);

print(
  "Target projection:",
  targetProjection_Prj,
  targetProjection_Prj.nominalScale()
);

// Prepare the Satellite Embedding dataset.
var embedding_IC = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL");

// Create a spatio-temporal Filter.
var year_Num = 2019;

var spatioTemporal_Filter = ee.Filter.and(
  ee.Filter.bounds(AOI_Geom),
  ee.Filter.calendarRange({
    start: year_Num,
    field: "year"
  })
);

// Spatio-temporal filtering.
var embeddingFiltered_IC = embedding_IC
  .filter(
    spatioTemporal_Filter
  );

print(
  "Embedding date:",
  ee.Date(
    ee.Image(embeddingFiltered_IC.first())
      .get("system:time_start")
  )
);

// Extract the projection of the first Embedding Image.
var embeddingProjection_Prj = embeddingFiltered_IC.first()
  .projection();

// print(
//   "Embedding projection (raw):",
//   embeddingProjection_Prj,
//   embeddingProjection_Prj.nominalScale()
// );

// Set the projection of the mosaic to the extracted projection.
var embedding_Img = embeddingFiltered_IC
  .mosaic()
  .setDefaultProjection(
    embeddingProjection_Prj
  );

print(
  "Embedding projection:",
  embedding_Img.projection(),
  embedding_Img.projection().nominalScale()
);

// GEDI L2 datasets.
var L2A_2019 = ee.Image("projects/wisconsin-gedi/assets/Annual_MedianGEDI/L2A/L2A_2019");
var L2B_2019 = ee.Image("projects/wisconsin-gedi/assets/Annual_MedianGEDI/L2B/L2B_2019");
var L2_2019 = L2A_2019.addBands(L2B_2019);

print(
  "L2_2019:",
  L2_2019,
  L2_2019.projection(),
  L2_2019.projection().nominalScale()
);

Map.addLayer(
  L2_2019.select("rh98"),
  {
    min: 0,
    max: 50,
    palette: "0000FF, FFFFFF, FF0000"
  },
  "rh98"
);

// Create a stacked Image with GEDI and Satellite Embedding.
var GEDIembedding_Img = L2_2019.addBands(embedding_Img);

// Average the continuous values at each 30-m pixel.
var reprojected_GEDIembedding_Img = GEDIembedding_Img
  .reduceResolution({
    reducer: ee.Reducer.mean()
  })
  .reproject(
    targetProjection_Prj
  );

// As larger GEDI pixels contain masked original pixels,
//   it has a transparency mask.
//   We update the mask to remove the transparency.
reprojected_GEDIembedding_Img = reprojected_GEDIembedding_Img
  .updateMask(
    reprojected_GEDIembedding_Img.mask().gt(0)
  );

// print(
//   "Stacked Image projection:",
//   reprojected_GEDIembedding_Img.projection(),
//   reprojected_GEDIembedding_Img.projection().nominalScale()
// );

// Export the stacked Image.
var exportFolder_Str = "projects/wisconsin-gedi/assets/Testing/";
var exportImage_Str = "GEDI_SatelliteEmbedding_Reprj";
var exportImagePath_Str = exportFolder_Str + exportImage_Str;

// if (false) {
  
//   var targetProjection_PrjInfo = targetProjection_Prj.getInfo();
  
//   print(
//     "Projection info:",
//     targetProjection_PrjInfo
//   );
  
//   Export.image.toAsset({
//     image: reprojected_GEDIembedding_Img,
//     description: exportImage_Str,
//     assetId: exportImagePath_Str,
//     region: AOI_Geom,
//     crs: targetProjection_PrjInfo.wkt,
//     crsTransform: targetProjection_PrjInfo.transform,
//     maxPixels: 1e13
//   }); // 7m.
// }

// if (false) {
  
//   // Load the exported asset (TESTING ONLY).
//   var reprojected_GEDIembedding_Img = ee.Image(exportImagePath_Str);
  
//   print(
//     "Exported Image projection:",
//     reprojected_GEDIembedding_Img.projection(),
//     reprojected_GEDIembedding_Img.projection().nominalScale()
//   );
// }

// Predictor/response bands.
var predictorNames_List = embedding_Img.bandNames();
var responseNames_List = L2_2019.bandNames();

var predictors_Img = reprojected_GEDIembedding_Img.select(predictorNames_List);
var response_Img   = reprojected_GEDIembedding_Img.select(responseNames_List);

// Derive the data mask of GEDI variables.
var GEDImask_Img = response_Img
  .mask()
  .reduce(ee.Reducer.min())
  .rename("GEDI_Mask");

// Keep only pixels where response exists (and thus GEDI is unmasked).
var observations_Img = predictors_Img
  .addBands(response_Img)
  .updateMask(GEDImask_Img);


// /**
// * Create a a unique, stable per-pixel integer ID (a "Pixel_Label")
// *   for every unmasked pixel using the 30-m grid.
// */

// var pixelLabelName_Str = "Pixel_Label";

// // Build an image of pixel coordinates on the 30-m grid.
// var xy_Img = ee.Image.pixelCoordinates(targetProjection_Prj)
//   .rename(["x", "y"])
//   .updateMask(GEDImask_Img);

// // Define the grid origin (upper-left) from the CRS transform.
// var originX_Num = -5802750;
// var originY_Num = 4984500;

// // Convert x-coordinate to a column index.
// var col_Img = xy_Img.select("x")
//   .subtract(originX_Num)
//   .divide(targetScale_Num)
//   .floor()
//   .toInt64();

// // Convert y-coordinate to a row index.
// //   Because y pixel size is negative, row increases as y decreases.
// var row_Img = ee.Image(originY_Num)
//   .subtract(xy_Img.select("y"))
//   .divide(targetScale_Num)
//   .floor()
//   .toInt64();

// // Pack (row, col) into one 64-bit integer ID.
// var pixelID_Img = row_Img.leftShift(32)
//   // Move the row value into the upper 32 bits of a 64-bit integer.
//   .add(col_Img)
//   // Store the column in the lower 32 bits.
//   .rename(pixelLabelName_Str)
//   .toInt64();

// // Add the label band back to the Image.
// observations_Img = pixelID_Img.addBands(observations_Img);

// print(
//   "observations_Img:",
//   observations_Img,
//   observations_Img.projection(),
//   observations_Img.projection().nominalScale()
// );

// One point per unmasked pixel (pixel-center points).
// var observations_FC = observations_Img.sample({

// var observations_FC = observations_Img.select(responseNames_List)
// // var observations_FC = observations_Img.select(predictorNames_List.slice(0, 10))
//   .sample({
//     region: AOI_Geom,
//     projection: targetProjection_Prj, // Use the exact target projection.
//     geometries: true,
//     dropNulls: true
//   });
if (false) {
  var observations_FC = ee.FeatureCollection(
    exportFolder_Str + "All_Responses_30000"
  );
  
  observations_FC = observations_Img.select(predictorNames_List.slice(0, 32))
    .sampleRegions({
      collection: observations_FC,
      scale: targetScale_Num,
      projection: targetProjection_Prj,
      geometries: true
    });
}

if (false) {
  var observations_FC = ee.FeatureCollection(
    exportFolder_Str + "All_observations_s32_30000"
  );
  
  observations_FC = observations_Img.select(predictorNames_List.slice(32, 64))
    .sampleRegions({
      collection: observations_FC,
      scale: targetScale_Num,
      projection: targetProjection_Prj,
      geometries: true
    });
}

// // print(observations_Img.select(predictorNames_List))
// observations_FC = observations_Img.select(predictorNames_List.slice(0, 32))
//   .reduceRegions({
//     collection: observations_FC,
//     reducer: ee.Reducer.first(),
//     scale: targetScale_Num,
//     crs: targetProjection_Prj
//   });

// observations_FC = observations_Img.select(predictorNames_List.slice(24, 48))
//   .reduceRegions({
//     collection: observations_FC,
//     reducer: ee.Reducer.first(),
//     scale: targetScale_Num,
//     crs: targetProjection_Prj
//   });

// // Vectorize the labelled observations.
// var observations_FC = observations_Img
//   .reduceToVectors({
//     reducer: ee.Reducer.first(),
//     geometry: AOI_Geom,
//     crs: targetProjection_Prj,
//     geometryType: "centroid",
//     eightConnected: false,
//     labelProperty: pixelLabelName_Str,
//     maxPixels: 1e13,
//     geometryInNativeProjection: true
//   });

var observationFileName_Str = "All_observations_s64_" + bufferRadius_Num;

if (false) {
  
  Export.table.toAsset({
    collection: observations_FC, 
    description: observationFileName_Str, 
    assetId: exportFolder_Str + observationFileName_Str
  }); // 1 min.
}

var training_FC = ee.FeatureCollection(
  exportFolder_Str + "All_observations_s64_30000"
);

// Train a regression model.
//   Use the RandomForest classifier and set the
//   output mode to REGRESSION.
var RF_model = ee.Classifier.smileRandomForest(100)
  .setOutputMode("REGRESSION")
  .train({
    features: training_FC,
    classProperty: "pavd_0_10",
    inputProperties: predictorNames_List
  });

// Get model's predictions for training samples.
var predicted_FC = training_FC.classify({
  classifier: RF_model,
  outputName: "pavd_0_10_predicted"
});

// Calculate RMSE.
var calculateRmse = function(input_FC) {
    var observed_Arr = ee.Array(
      input_FC.aggregate_array("pavd_0_10"));
    
    var predicted_Arr = ee.Array(
      input_FC.aggregate_array("pavd_0_10_predicted"));
    
    var rmse_Num = observed_Arr.subtract(predicted_Arr).pow(2)
      .reduce(ee.Reducer.mean(), [0]).sqrt().get([0]);
    
    return rmse_Num;
};

var RMSE_Num = calculateRmse(predicted_FC);

print("RMSE:", RMSE_Num); // 0.038.

// Create a plot of observed vs. predicted values.
var comparison_Chart = ui.Chart.feature.byFeature({
  features: predicted_FC.limit(5e3).select(["pavd_0_10", "pavd_0_10_predicted"]),
  xProperty: "pavd_0_10",
  yProperties: ["pavd_0_10_predicted"],
}).setChartType("ScatterChart")
  .setOptions({
    title: "pavd_0_10",
    dataOpacity: 0.5,
    hAxis: {"title": "Observed"},
    vAxis: {"title": "Predicted"},
    legend: {position: "right"},
    series: {
      0: {
        visibleInLegend: false,
        color: "#0571b0",
        pointSize: 3,
        pointShape: "circle",
      },
    },
    trendlines: {
      0: {
        type: "linear",
        color: "#ca0020",
        lineWidth: 1,
        pointSize: 0,
        labelInLegend: "Trend line",
        visibleInLegend: true,
        showR2: true
      }
    },
    chartArea: {left: 100, bottom: 100, width: "50%"}
  });

print(comparison_Chart);

