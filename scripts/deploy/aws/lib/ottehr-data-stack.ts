import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface OttehrDataStackProps extends cdk.StackProps {
  patientPortalBucket: s3.Bucket;
  ehrBucket: s3.Bucket;
  patientPortalDistribution: cloudfront.Distribution;
  ehrDistribution: cloudfront.Distribution;
}

export class OttehrDataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OttehrDataStackProps) {
    super(scope, id, props);

    // This has to be named intake because it's used to find assets in repo
    uploadWebsiteAssets(this, 'intake', props.patientPortalBucket, props.patientPortalDistribution);
    uploadWebsiteAssets(this, 'ehr', props.ehrBucket, props.ehrDistribution);
  }
}

function uploadWebsiteAssets(
  scope: Construct,
  website: 'intake' | 'ehr',
  bucket: s3.Bucket,
  distribution: cloudfront.Distribution
): void {
  new s3deploy.BucketDeployment(scope, `upload-${website}-to-s3-bucket`, {
    destinationBucket: bucket,
    sources: [s3deploy.Source.asset(`../../../apps/${website}/build`)],
    memoryLimit: 2048,
    distribution,
  });
}
