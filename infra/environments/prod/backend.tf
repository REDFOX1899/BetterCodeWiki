terraform {
  backend "gcs" {
    bucket = "gitunderstand-tfstate"
    prefix = "prod"
  }
}
