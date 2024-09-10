import * as cdk from 'aws-cdk-lib';
import fs from 'fs';
import { Construct } from 'constructs';
import fetch from 'node-fetch';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
import config from "../config.json";
import { getCloudFrontDistributions } from '../bin/deploy-test';

export class DeployTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    if (!("project_identifier" in config)) {
      throw new Error("project_identifier is required");
    }

    const projectConfig: any = config;
    const projectIdentifier = projectConfig.project_identifier;
    const projectID = projectConfig.project_id;
    const accessToken = projectConfig.access_token;
    const providerEmail = projectConfig.provider_email;
    const environment = projectConfig.environment;

    let domain = "domain" in projectConfig ? projectConfig.domain : "ottehr.com";
    let intakeSubdomain = "intake_subdomain" in projectConfig ? projectConfig.intake_subdomain : "intake";
    let ehrSubdomain = "ehr_subdomain" in projectConfig ? projectConfig.ehr_subdomain : "ehr";
    const intakeBucket = deployWebsite(this, "intake", projectIdentifier, domain, intakeSubdomain);
    const ehrBucket = deployWebsite(this, "ehr", projectIdentifier, domain, ehrSubdomain);
    setupCloudfront(this, "intake", intakeBucket);
    setupCloudfront(this, "ehr", ehrBucket);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DeployTestQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    
  }
}

export async function updateZambdas(environment: string, projectID: string, accessToken: string) {
  const zambdasRequest = await fetch('https://project-api.zapehr.com/v1/zambda', {
    headers: {
      'x-zapehr-project-id': projectID,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const zambdas = await zambdasRequest.json();
  let intakeEnvFile = fs.readFileSync(`../../packages/telemed-intake/app/env/.env.${environment}`, 'utf8');
  let ehrEnvFile = fs.readFileSync(`../../packages/telemed-ehr/app/env/.env.${environment}`, 'utf8');
  intakeEnvFile = intakeEnvFile.replace(/paperwork\//g, '');
  intakeEnvFile = intakeEnvFile.replace("http://localhost:3000/local", "https://project-api.zapehr.com/v1");
  ehrEnvFile = ehrEnvFile.replace("http://localhost:3000/local", "https://project-api.zapehr.com/v1");
  ehrEnvFile = ehrEnvFile.replace("http://localhost:4000/local", "https://project-api.zapehr.com/v1");
  intakeEnvFile = intakeEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  ehrEnvFile = ehrEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  const distributionsRequest = await getCloudFrontDistributions();
  const intakeDistribution = distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-intake');
  const ehrDistribution = distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-ehr');
  if (intakeDistribution) {
    ehrEnvFile = ehrEnvFile.replace('VITE_APP_QRS_URL=http://localhost:3002', `VITE_APP_QRS_URL=${`https://${intakeDistribution.DomainName}`}`);
  }
  if (ehrDistribution) {
    ehrEnvFile = ehrEnvFile.replace('VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL=http://localhost:4002', `VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL=https://${ehrDistribution.DomainName}`)
  }
  zambdas.forEach((zambda: any) => {
    // remove prefix from zambda name
    let zambdaName = zambda.name.split('-').slice(1).join('-');
    if (zambda.name.startsWith('telemed-')) {
      intakeEnvFile = intakeEnvFile.replace(zambdaName, zambda.id);
    } else if (zambda.name.startsWith('admin-')) {
      ehrEnvFile = ehrEnvFile.replace(zambdaName, zambda.id);
    }

    if (zambda.name === 'telemed-create-appointment') {
      ehrEnvFile = ehrEnvFile.replace('create-appointment', zambda.id);
    }
    if (zambda.name === 'telemed-check-in') {
      ehrEnvFile = ehrEnvFile.replace('check-in', zambda.id);
    }
  });
  fs.writeFileSync(`../../packages/telemed-intake/app/env/.env.${environment}`, intakeEnvFile);
  fs.writeFileSync(`../../packages/telemed-ehr/app/env/.env.${environment}`, ehrEnvFile);
}

function deployWebsite(scope: Construct, website: "intake" | "ehr", projectIdentifier: string, domain: string, subdomain: string) {
  const bucketTemp = new s3.Bucket(scope, `create-${website}-s3-bucket`, {
    publicReadAccess: true,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: 'index.html',
    blockPublicAccess: {
      blockPublicAcls: true,
      blockPublicPolicy: false,
      ignorePublicAcls: true,
      restrictPublicBuckets: false,
    },
    // websiteErrorDocument: ''
    bucketName: `ottehr-${projectIdentifier}-${subdomain}.${domain}`
  });

  new s3deploy.BucketDeployment(scope, `upload-${website}-to-s3-bucket`, {
    destinationBucket: bucketTemp,
    sources: [s3deploy.Source.asset(`../../packages/telemed-${website}/app/build`)]
  });
  return bucketTemp;
}

function setupCloudfront(scope: Construct, website: "intake" | "ehr", bucket: s3.Bucket) {
  new cloudfront.Distribution(scope, `create-${website}-cloudfront-distribution`, {
    defaultBehavior: {
      origin: new cloudfront_origins.S3Origin(bucket),
    },
    comment: `ottehr-${website}`
  });
}
