async function createProducts() {
  const products = structuredClone(config.get<ProductConfig[]>('products')).map((product) => {
    product.price = product.price ?? Math.floor(Math.random() * 9 + 1)
    product.deluxePrice = product.deluxePrice ?? product.price
    product.description = product.description || 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit.'

    // set default image values
    product.image = product.image ?? 'undefined.png'
    if (utils.isUrl(product.image)) {
      const imageUrl = product.image
      product.image = utils.extractFilename(product.image)
      void utils.downloadToFile(imageUrl, 'frontend/dist/frontend/assets/public/images/products/' + product.image)
    }
    return product
  })

  // Challenge-specific modifications
  const christmasChallengeProduct = products.find(p => p.useForChristmasSpecialChallenge)
  const tamperingChallengeProduct = products.find(p => p.urlForProductTamperingChallenge)
  const pastebinLeakChallengeProduct = products.find(p => p.keywordsForPastebinDataLeakChallenge)
  const blueprintRetrievalChallengeProduct = products.find(p => p.fileForRetrieveBlueprintChallenge)

  if (christmasChallengeProduct) {
    christmasChallengeProduct.description += ' (Seasonal special offer! Limited availability!)'
    christmasChallengeProduct.deletedDate = '2014-12-27 00:00:00.000 +00:00'
  }
  if (tamperingChallengeProduct) {
    tamperingChallengeProduct.description += ` <a href="${tamperingChallengeProduct.urlForProductTamperingChallenge}" target="_blank">More...</a>`
    delete tamperingChallengeProduct.deletedDate
  }
  if (pastebinLeakChallengeProduct) {
    pastebinLeakChallengeProduct.description += ' (This product is unsafe! We plan to remove it from the stock!)'
    pastebinLeakChallengeProduct.deletedDate = '2019-02-01 00:00:00.000 +00:00'
  }
  if (blueprintRetrievalChallengeProduct) {
    let blueprint = blueprintRetrievalChallengeProduct.fileForRetrieveBlueprintChallenge!
    if (utils.isUrl(blueprint)) {
      const blueprintUrl = blueprint
      blueprint = utils.extractFilename(blueprint)
      await utils.downloadToFile(blueprintUrl, 'frontend/dist/frontend/assets/public/images/products/' + blueprint)
    }
    datacache.setRetrieveBlueprintChallengeFile(blueprint)
  }

  // Insert products and reviews
  for (const product of products) {
    let persistedProduct
    try {
      persistedProduct = await ProductModel.create({
        name: product.name,
        description: product.description,
        price: product.price,
        deluxePrice: product.deluxePrice,
        image: product.image
      })
    } catch (err) {
      logger.error(`Could not insert Product "${product.name}": ${utils.getErrorMessage(err)}`)
      continue
    }

    if (!persistedProduct) continue

    // Handle challenges
    if (product.useForChristmasSpecialChallenge) datacache.products.christmasSpecial = persistedProduct
    if (product.urlForProductTamperingChallenge) {
      datacache.products.osaft = persistedProduct
      try {
        await datacache.challenges.changeProductChallenge.update({
          description: customizeChangeProductChallenge(
            datacache.challenges.changeProductChallenge.description,
            config.get('challenges.overwriteUrlForProductTamperingChallenge'),
            persistedProduct
          )
        })
      } catch (err) {
        logger.error(`Could not update changeProductChallenge: ${utils.getErrorMessage(err)}`)
      }
    }
    if (product.deletedDate) await deleteProduct(persistedProduct.id)

    // Insert reviews safely
    if (product.reviews && product.reviews.length > 0) {
      for (const review of product.reviews) {
        try {
          await reviewsCollection.insert({
            message: review.text,
            author: datacache.users[review.author]?.email ?? 'unknown',
            product: persistedProduct.id,
            likesCount: 0,
            likedBy: []
          })
        } catch (err) {
          logger.error(`Could not insert Product Review "${review.text}": ${utils.getErrorMessage(err)}`)
        }
      }
    }
  }

  // Helper function
  function customizeChangeProductChallenge(description: string, customUrl: string, customProduct: Product) {
    let customDescription = description.replace(/OWASP SSL Advanced Forensic Tool \(O-Saft\)/g, customProduct.name)
    customDescription = customDescription.replace('https://owasp.slack.com', customUrl)
    return customDescription
  }
}
