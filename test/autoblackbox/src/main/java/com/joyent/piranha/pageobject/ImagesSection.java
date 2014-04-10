package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class ImagesSection extends AbstractPageObject {
    public void setImageName(String imageName) {
        $("[name=\"imageName\"]").sendKeys(imageName);
    }

    public void clickCreateImage(){
        $("[data-ng-click=\"clickCreateImage()\"]").click();
    }

    public ImageList clickMyImagesList(){
        $("[href=\"#!/images\"]").click();
        return page(ImageList.class);
    }
}
