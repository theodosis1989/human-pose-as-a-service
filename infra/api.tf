resource "aws_apigatewayv2_api" "video_api_http" {
  name          = "video-api-http"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins  = var.allowed_origins
    allow_headers  = ["Authorization", "Content-Type"]
    allow_methods  = ["GET", "OPTIONS"]
    expose_headers = ["Content-Type"]
    max_age        = 300
  }
}

resource "aws_apigatewayv2_integration" "video_api_integ" {
  api_id                 = aws_apigatewayv2_api.video_api_http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.video_api.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "upload_url_route" {
  api_id    = aws_apigatewayv2_api.video_api_http.id
  route_key = "GET /upload-url"
  target    = "integrations/${aws_apigatewayv2_integration.video_api_integ.id}"
}

resource "aws_lambda_permission" "apigw_invoke_video_api" {
  statement_id  = "AllowAPIGatewayInvokeVideoAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_api_http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_stage" "video_api_stage" {
  api_id      = aws_apigatewayv2_api.video_api_http.id
  name        = "$default"
  auto_deploy = true
}

output "video_api_base_url" {
  value = aws_apigatewayv2_api.video_api_http.api_endpoint
}